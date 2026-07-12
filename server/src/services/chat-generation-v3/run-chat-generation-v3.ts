import { structuredLogger } from "../../core/logging/structured-logger";

import { ProfileSessionArtifactStore } from "./artifacts/profile-session-artifact-store";
import { RunArtifactStore } from "./artifacts/run-artifact-store";
import { defaultGenerationControlPort } from "./control/generation-control-port";
import { isChatGenerationDebugEnabled } from "./debug";
import { runMainLlmPhase } from "./main-llm/run-main-llm-phase";
import {
  normalizeOperationActivationConfig,
  resolveOperationActivationState,
} from "./operations/operation-activation-intervals";
import { finalizeRunFailure } from "./orchestration/finalize-run-failure";
import { RunEventStream } from "./orchestration/run-event-stream";
import { runOperationHookPhase } from "./orchestration/run-operation-hook-phase";
import {
  buildRunDebugStateSnapshot,
  buildRunResult,
  cloneLlmMessages,
  clonePromptDraftMessages,
  createInitialRunState,
  markRunPhase,
  mergeArtifacts,
} from "./orchestration/run-state-helpers";
import { defaultGenerationPersistencePort } from "./persist/generation-persistence-port";
import { resolveRunContext } from "./prepare/resolve-run-context";
import { buildBasePrompt } from "./prompt/build-base-prompt";
import {
  buildPromptDiagnosticsDebugJson,
  buildRedactedSnapshot,
  draftToLlmMessages,
  hashPromptMessages,
  normalizeLlmMessagesForDebug,
  sumContextTokensByMessages,
} from "./prompt/generation-debug-payload";
import {
  ChatRuntimeStateRepository,
  type ChatRuntimeStatePayload,
  type ChatRuntimeStateScope,
} from "./runtime/chat-runtime-state-repository";
import { loadOrBootstrapRuntimeState } from "./runtime/operation-runtime-state";

import type { OperationSkipDetails, RunEvent, RunRequest, RunState } from "./contracts";
import type { OperationInProfile } from "@shared/types/operation-profiles";

function supportsCurrentTrigger(op: OperationInProfile, trigger: "generate" | "regenerate"): boolean {
  const triggers = op.config.triggers ?? ["generate", "regenerate"];
  return triggers.includes(trigger);
}

async function resolveOperationActivationDecisions(params: {
  source: RunRequest["source"];
  trigger: "generate" | "regenerate";
  operations: OperationInProfile[];
  previousByOpId: Record<string, { turnsCounter: number; tokensCounter: number }>;
  currentContextTokens: number;
}): Promise<{
  activationSkippedByOpId: ReadonlyMap<string, NonNullable<OperationSkipDetails["activation"]>>;
  nextByOpId: Record<string, { turnsCounter: number; tokensCounter: number }>;
  debugSnapshot: Array<{
    opId: string;
    everyNTurns?: number;
    everyNContextTokens?: number;
    turnsCounter: number;
    tokensCounter: number;
    shouldRunNow: boolean;
    hasActivation: boolean;
    supportsCurrentTrigger: boolean;
  }>;
}> {
  const activationSkippedByOpId = new Map<string, NonNullable<OperationSkipDetails["activation"]>>();
  const nextByOpId: Record<string, { turnsCounter: number; tokensCounter: number }> = {
    ...params.previousByOpId,
  };
  const debugSnapshot: Array<{
    opId: string;
    everyNTurns?: number;
    everyNContextTokens?: number;
    turnsCounter: number;
    tokensCounter: number;
    shouldRunNow: boolean;
    hasActivation: boolean;
    supportsCurrentTrigger: boolean;
  }> = [];
  if (params.operations.length === 0) return { activationSkippedByOpId, nextByOpId, debugSnapshot };

  for (const op of params.operations) {
    const supportsCurrent = supportsCurrentTrigger(op, params.trigger);
    const activationResolution = resolveOperationActivationState({
      activation: op.config.activation,
      previous: params.previousByOpId[op.opId],
      source: params.source,
      currentContextTokens: params.currentContextTokens,
      supportsCurrentTrigger: supportsCurrent,
    });
    const normalizedActivation = normalizeOperationActivationConfig(op.config.activation);
    debugSnapshot.push({
      opId: op.opId,
      everyNTurns: normalizedActivation?.everyNTurns,
      everyNContextTokens: normalizedActivation?.everyNContextTokens,
      turnsCounter: activationResolution.nextState.turnsCounter,
      tokensCounter: activationResolution.nextState.tokensCounter,
      shouldRunNow: activationResolution.shouldRunNow,
      hasActivation: activationResolution.hasActivation,
      supportsCurrentTrigger: supportsCurrent,
    });

    if (!activationResolution.hasActivation) continue;

    nextByOpId[op.opId] = activationResolution.nextState;
    if (
      !activationResolution.shouldRunNow &&
      supportsCurrent &&
      activationResolution.skipSnapshot
    ) {
      activationSkippedByOpId.set(op.opId, activationResolution.skipSnapshot);
    }
  }

  return { activationSkippedByOpId, nextByOpId, debugSnapshot };
}

export async function* runChatGenerationV3(
  request: RunRequest
): AsyncGenerator<RunEvent> {
  const abortController = request.abortController ?? new AbortController();
  const eventStream = new RunEventStream();
  let context: Awaited<ReturnType<typeof resolveRunContext>>["context"] | null = null;
  let runState: RunState | null = null;
  let finalized = false;
  let controlLease: Awaited<
    ReturnType<(typeof defaultGenerationControlPort)["acquire"]>
  > | null = null;
  const prepareStartedAt = Date.now();
  const debugEnabled = isChatGenerationDebugEnabled(request.settings);
  const emit = (type: RunEvent["type"], data: unknown): void => {
    eventStream.emit(type, data);
  };
  const streamEventsWhile = <T>(work: Promise<T>): AsyncGenerator<RunEvent, T> =>
    eventStream.streamEventsWhile(work);
  const markPhase = (
    phase: RunState["phaseReports"][number]["phase"],
    status: "done" | "failed" | "aborted",
    startedAt: number,
    message?: string
  ): void => {
    markRunPhase(runState, phase, status, startedAt, message);
  };
  const emitStateSnapshot = (
    stage: "post_build_base_prompt" | "post_commit_before" | "post_main_llm" | "post_commit_after"
  ): void => {
    if (!debugEnabled || !runState) return;
    emit("run.debug.state_snapshot", buildRunDebugStateSnapshot(runState, stage));
  };

  try {
    const resolved = await resolveRunContext({ request });
    context = resolved.context;
    eventStream.setRunId(context.runId);
    runState = createInitialRunState({});
    emit("run.started", {
      generationId: context.generationId,
      trigger: context.trigger,
    });
    controlLease = await defaultGenerationControlPort.acquire({
      generationId: context.generationId,
      runInstanceId: context.runId,
      abortController,
    });
    structuredLogger.info("generation.started", {
      event: "generation.started",
      requestId: request.requestId ?? null,
      generationId: context.generationId,
      runId: context.runId,
      chatId: context.chatId,
      branchId: context.branchId,
      profileId: context.profileSnapshot?.profileId ?? null,
    });
    const persistedArtifactsSnapshot =
      context.sessionKey && context.profileSnapshot
        ? await ProfileSessionArtifactStore.load({
            ownerId: context.ownerId,
            sessionKey: context.sessionKey,
          })
        : {};

    runState.persistedArtifactsSnapshot = persistedArtifactsSnapshot;
    markPhase("prepare_run_context", "done", prepareStartedAt);
    yield* eventStream.flushEvents();

    emit("run.phase_changed", { phase: "build_base_prompt" });
    const buildStartedAt = Date.now();
    const basePrompt = await buildBasePrompt({
      ownerId: context.ownerId,
      chatId: context.chatId,
      branchId: context.branchId,
      entityProfileId: context.entityProfileId,
      historyLimit: context.historyLimit,
      trigger: context.trigger,
      scanSeed: context.generationId,
      excludeEntryIds: [request.persistenceTarget.assistantEntryId],
    });
    runState.basePromptDraft = basePrompt.prompt.draftMessages.map((m) => ({ ...m }));
    runState.effectivePromptDraft = basePrompt.prompt.draftMessages.map((m) => ({ ...m }));
    emitStateSnapshot("post_build_base_prompt");
    markPhase("build_base_prompt", "done", buildStartedAt);
    yield* eventStream.flushEvents();

    const profileOperations = context.profileSnapshot?.operations ?? [];
    let runtimeScope: ChatRuntimeStateScope | null = null;
    let runtimePayload: ChatRuntimeStatePayload | null = null;
    if (context.profileSnapshot) {
      runtimeScope = {
        ownerId: context.ownerId,
        chatId: context.chatId,
        branchId: context.branchId,
        profileId: context.profileSnapshot.profileId,
        operationProfileSessionId: context.profileSnapshot.operationProfileSessionId,
      };
      const resolvedRuntime = await loadOrBootstrapRuntimeState({
        scope: runtimeScope,
        operations: profileOperations,
        source: request.source,
      });
      runtimePayload = resolvedRuntime.payload;
    }

    const activationDecisions = await resolveOperationActivationDecisions({
      source: request.source,
      trigger: context.trigger,
      operations: profileOperations,
      previousByOpId: runtimePayload?.activationByOpId ?? {},
      currentContextTokens: sumContextTokensByMessages(runState.effectivePromptDraft),
    });
    if (runtimeScope && runtimePayload) {
      const nextRuntime = await ChatRuntimeStateRepository.upsert({
        scope: runtimeScope,
        payload: {
          ...runtimePayload,
          activationByOpId: activationDecisions.nextByOpId,
        },
      });
      runtimePayload = nextRuntime.payload;
      if (debugEnabled) {
        emit("run.debug.operation_activation_state_snapshot", {
          chatId: context.chatId,
          branchId: context.branchId,
          profileId: context.profileSnapshot?.profileId ?? null,
          operationProfileSessionId: context.profileSnapshot?.operationProfileSessionId ?? null,
          updatedAt: nextRuntime.updatedAt.toISOString(),
          source: request.source,
          trigger: context.trigger,
          operations: activationDecisions.debugSnapshot,
        });
      }
    }
    const executionMode = context.profileSnapshot?.executionMode ?? "sequential";
    const runArtifactStore = new RunArtifactStore();
    const mainPhaseSettings = {
      ...(basePrompt.instructionDerivedSettings ?? {}),
      ...(request.settings ?? {}),
    };

    const commitBefore = yield* runOperationHookPhase({
      hook: "before_main_llm",
      runId: context.runId,
      trigger: context.trigger,
      operations: profileOperations,
      activationSkippedByOpId: activationDecisions.activationSkippedByOpId,
      executionMode,
      baseMessages: runState.effectivePromptDraft,
      baseArtifacts: mergeArtifacts(runState.persistedArtifactsSnapshot, runState.runArtifacts),
      assistantText: runState.assistantText,
      templateContext: basePrompt.templateContext,
      abortSignal: abortController.signal,
      runState,
      runArtifactStore,
      ownerId: context.ownerId,
      chatId: context.chatId,
      branchId: context.branchId,
      profile: resolved.profile,
      sessionKey: context.sessionKey,
      persistenceTarget: request.persistenceTarget,
      userTurnTarget: request.userTurnTarget,
      debugEnabled,
      emit,
      streamEventsWhile,
      markPhase,
      executePhaseName: "execute_before_operations",
      commitPhaseName: "commit_before_effects",
      requiredCommitErrorMessage: "required before commit failed",
      stateSnapshotStage: "post_commit_before",
      emitStateSnapshot,
    });
    yield* eventStream.flushEvents();

    emit("run.phase_changed", { phase: "before_barrier" });
    const barrierStartedAt = Date.now();
    const requiredBeforeNotDone = runState.operationResultsByHook.before_main_llm.filter(
      (item) =>
        item.required &&
        item.status !== "done" &&
        item.skipReason !== "activation_not_reached"
    );
    const beforeBarrierFailed =
      requiredBeforeNotDone.length > 0 || commitBefore.requiredError;
    if (beforeBarrierFailed) {
      runState.finishedStatus = "failed";
      runState.failedType = "before_barrier";
      runState.errorMessage =
        commitBefore.requiredError
          ? "Required before effect commit failed"
          : "Required before operation did not finish with done";
      markPhase("before_barrier", "failed", barrierStartedAt, runState.errorMessage);
    } else {
      markPhase("before_barrier", "done", barrierStartedAt);
    }
    yield* eventStream.flushEvents();

    runState.llmMessages = draftToLlmMessages(runState.effectivePromptDraft);
    runState.promptHash = hashPromptMessages(runState.llmMessages);
    runState.promptSnapshot = buildRedactedSnapshot(runState.llmMessages, {
      historyLimit: context.historyLimit,
      historyReturnedCount: basePrompt.prompt.historyReturnedCount,
      worldInfoMeta: basePrompt.prompt.promptSnapshot.meta.worldInfo,
    });

    await defaultGenerationPersistencePort.persistPromptData({
      generationId: context.generationId,
      promptHash: runState.promptHash,
      promptSnapshot: runState.promptSnapshot,
    });
    const promptDiagnosticsDebug = buildPromptDiagnosticsDebugJson({
      llmMessages: runState.llmMessages,
      systemPrompt: basePrompt.prompt.systemPrompt,
      templateHistoryMessages: basePrompt.templateContext.messages,
      worldInfoDiagnostics: basePrompt.worldInfoDiagnostics,
      turnUserCanonicalization: runState.turnUserCanonicalizationHistory,
    });
    await defaultGenerationPersistencePort.persistDebugData({
      generationId: context.generationId,
      debug: promptDiagnosticsDebug,
    });

    if (debugEnabled && runState.promptHash) {
      const normalizedLlmMessages = normalizeLlmMessagesForDebug(
        runState.llmMessages,
        context.runtimeInfo.messageNormalization
      );
      emit("run.debug.main_llm_input", {
        promptHash: runState.promptHash,
        basePromptDraft: clonePromptDraftMessages(runState.basePromptDraft),
        effectivePromptDraft: clonePromptDraftMessages(runState.effectivePromptDraft),
        llmMessages: cloneLlmMessages(runState.llmMessages),
        normalizedLlmMessages,
      });
    }

    if (!beforeBarrierFailed) {
      emit("run.phase_changed", { phase: "run_main_llm" });
      emit("main_llm.started", {
        model: context.runtimeInfo.model,
        providerId: context.runtimeInfo.providerId,
      });
      const mainStartedAt = Date.now();
      const main = yield* streamEventsWhile(
        runMainLlmPhase({
          request: {
            ...request,
            settings: mainPhaseSettings,
          },
          runState,
          ownerId: context.ownerId,
          abortController,
          onDelta: (content) => emit("main_llm.delta", { content }),
          onReasoningDelta: (content) =>
            emit("main_llm.reasoning_delta", { content }),
        })
      );
      emit("main_llm.finished", {
        status: main.status,
        message: main.message,
      });
      markPhase(
        "run_main_llm",
        main.status === "done" ? "done" : main.status === "aborted" ? "aborted" : "failed",
        mainStartedAt,
        main.message
      );
      emitStateSnapshot("post_main_llm");
      yield* eventStream.flushEvents();

      if (main.status === "aborted") {
        runState.finishedStatus = "aborted";
      } else if (main.status === "error") {
        runState.finishedStatus = "failed";
        runState.failedType = "main_llm";
        runState.errorMessage = main.message ?? "Main LLM failed";
      } else {
        const afterBaseMessages = [
          ...runState.effectivePromptDraft.map((m) => ({ ...m })),
          { role: "assistant" as const, content: runState.assistantText },
        ];
        const commitAfter = yield* runOperationHookPhase({
          hook: "after_main_llm",
          runId: context.runId,
          trigger: context.trigger,
          operations: profileOperations,
          activationSkippedByOpId: activationDecisions.activationSkippedByOpId,
          executionMode,
          baseMessages: afterBaseMessages,
          baseArtifacts: mergeArtifacts(runState.persistedArtifactsSnapshot, runState.runArtifacts),
          assistantText: runState.assistantText,
          templateContext: basePrompt.templateContext,
          abortSignal: abortController.signal,
          runState,
          runArtifactStore,
          ownerId: context.ownerId,
          chatId: context.chatId,
          branchId: context.branchId,
          profile: resolved.profile,
          sessionKey: context.sessionKey,
          persistenceTarget: request.persistenceTarget,
          userTurnTarget: request.userTurnTarget,
          debugEnabled,
          emit,
          streamEventsWhile,
          markPhase,
          executePhaseName: "execute_after_operations",
          commitPhaseName: "commit_after_effects",
          requiredCommitErrorMessage: "required after commit failed",
          stateSnapshotStage: "post_commit_after",
          emitStateSnapshot,
        });
        yield* eventStream.flushEvents();
        await defaultGenerationPersistencePort.persistDebugData({
          generationId: context.generationId,
          debug: buildPromptDiagnosticsDebugJson({
            llmMessages: runState.llmMessages,
            systemPrompt: basePrompt.prompt.systemPrompt,
            templateHistoryMessages: basePrompt.templateContext.messages,
            worldInfoDiagnostics: basePrompt.worldInfoDiagnostics,
            turnUserCanonicalization: runState.turnUserCanonicalizationHistory,
          }),
        });

        const requiredAfterNotDone = runState.operationResultsByHook.after_main_llm.filter(
          (item) =>
            item.required &&
            item.status !== "done" &&
            item.skipReason !== "activation_not_reached"
        );
        if (commitAfter.requiredError || requiredAfterNotDone.length > 0) {
          runState.finishedStatus = "failed";
          runState.failedType = "after_main_llm";
          runState.errorMessage =
            commitAfter.requiredError
              ? "Required after effect commit failed"
              : "Required after operation did not finish with done";
        } else {
          runState.finishedStatus = "done";
        }
      }
    }

    emit("run.phase_changed", { phase: "persist_finalize" });
    const finalizeStartedAt = Date.now();
    markPhase(
      "persist_finalize",
      (runState.finishedStatus ?? "error") === "done"
        ? "done"
        : (runState.finishedStatus ?? "error") === "aborted"
          ? "aborted"
          : "failed",
      finalizeStartedAt
    );
    const result = buildRunResult({ context, runState });
    await defaultGenerationPersistencePort.finalize({ context, result });
    finalized = true;
    structuredLogger.info("generation.finished", {
      event: "generation.finished",
      requestId: request.requestId ?? null,
      generationId: context.generationId,
      runId: context.runId,
      chatId: context.chatId,
      branchId: context.branchId,
      profileId: context.profileSnapshot?.profileId ?? null,
      status: result.status,
      failedType: result.failedType,
    });
    emit("run.finished", {
      generationId: context.generationId,
      status: result.status,
      failedType: result.failedType,
      message: result.errorMessage ?? undefined,
    });
    yield* eventStream.flushEvents();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!context || !runState) {
      yield {
        runId: request.requestId ?? "preparation",
        seq: 1,
        type: "run.preparation_failed",
        data: {
          generationId: null,
          status: "error",
          code: "generation_preparation_error",
          message,
        },
      };
      return;
    }
    if (!finalized) {
      const result = await finalizeRunFailure({
        requestId: request.requestId,
        context,
        runState,
        errorMessage: message,
        aborted: abortController.signal.aborted,
        prepareStartedAt,
      });
      finalized = true;
      emit("run.finished", {
        generationId: context.generationId,
        status: result.status,
        failedType: result.failedType,
        message,
      });
      yield* eventStream.flushEvents();
    }
  } finally {
    await controlLease?.release({ status: runState?.finishedStatus ?? null });
  }
}
