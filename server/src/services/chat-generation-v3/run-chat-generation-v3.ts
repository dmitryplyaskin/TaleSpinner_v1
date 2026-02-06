import crypto from "crypto";

import { unregisterGeneration, registerGeneration } from "../chat-core/generation-runtime";
import { updateGenerationPromptData } from "../chat-core/generations-repository";
import { ProfileSessionArtifactStore } from "./artifacts/profile-session-artifact-store";
import { RunArtifactStore } from "./artifacts/run-artifact-store";
import type {
  ArtifactValue,
  PromptDraftMessage,
  PromptSnapshotV1,
  RunEvent,
  RunDebugStateSnapshotStage,
  RunRequest,
  RunResult,
  RunState,
} from "./contracts";
import { isChatGenerationDebugEnabled } from "./debug";
import { runMainLlmPhase } from "./main-llm/run-main-llm-phase";
import { commitEffectsPhase } from "./operations/commit-effects-phase";
import { executeOperationsPhase } from "./operations/execute-operations-phase";
import { finalizeRun } from "./persist/finalize-run";
import { buildBasePrompt } from "./prompt/build-base-prompt";
import { resolveRunContext } from "./prepare/resolve-run-context";

import type { GenerateMessage } from "@shared/types/generate";
import type { OperationHook } from "@shared/types/operation-profiles";

function draftToLlmMessages(draft: PromptDraftMessage[]): GenerateMessage[] {
  return draft
    .map((m) => ({ role: (m.role === "developer" ? "system" : m.role) as GenerateMessage["role"], content: m.content.trim() }))
    .filter((m) => m.content.length > 0);
}

function hashPromptMessages(messages: GenerateMessage[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(messages)).digest("hex");
}

function buildRedactedSnapshot(
  messages: GenerateMessage[],
  params: { historyLimit: number; historyReturnedCount: number }
): PromptSnapshotV1 {
  const MAX_MSG_CHARS = 4_000;
  const MAX_TOTAL_CHARS = 50_000;
  let total = 0;
  let truncated = false;
  const snapshotMessages: PromptSnapshotV1["messages"] = [];

  for (const m of messages) {
    let content = m.content ?? "";
    if (content.length > MAX_MSG_CHARS) {
      content = `${content.slice(0, MAX_MSG_CHARS)}…`;
      truncated = true;
    }
    if (total + content.length > MAX_TOTAL_CHARS) {
      const remaining = Math.max(0, MAX_TOTAL_CHARS - total);
      content = remaining > 0 ? `${content.slice(0, remaining)}…` : "…";
      truncated = true;
    }
    total += content.length;
    snapshotMessages.push({ role: m.role, content });
    if (total >= MAX_TOTAL_CHARS) break;
  }

  return {
    v: 1,
    messages: snapshotMessages,
    truncated,
    meta: {
      historyLimit: params.historyLimit,
      historyReturnedCount: params.historyReturnedCount,
    },
  };
}

function mergeArtifacts(
  persisted: RunState["persistedArtifactsSnapshot"],
  runOnly: RunState["runArtifacts"]
): Record<string, { value: string; history: string[] }> {
  return Object.fromEntries(
    Object.entries({ ...persisted, ...runOnly }).map(([tag, value]) => [
      tag,
      { value: value.value, history: [...value.history] },
    ])
  );
}

function mergeArtifactsForDebug(
  persisted: RunState["persistedArtifactsSnapshot"],
  runOnly: RunState["runArtifacts"]
): Record<string, ArtifactValue> {
  const merged: Record<string, ArtifactValue> = {};
  for (const [tag, value] of Object.entries(persisted)) {
    merged[tag] = {
      usage: value.usage,
      semantics: value.semantics,
      persistence: value.persistence,
      value: value.value,
      history: [...value.history],
    };
  }
  for (const [tag, value] of Object.entries(runOnly)) {
    merged[tag] = {
      usage: value.usage,
      semantics: value.semantics,
      persistence: value.persistence,
      value: value.value,
      history: [...value.history],
    };
  }
  return merged;
}

function clonePromptDraftMessages(messages: PromptDraftMessage[]): PromptDraftMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function cloneLlmMessages(messages: GenerateMessage[]): GenerateMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export async function* runChatGenerationV3(
  request: RunRequest
): AsyncGenerator<RunEvent> {
  const abortController = request.abortController ?? new AbortController();
  const pendingEvents: RunEvent[] = [];
  let seq = 0;
  let runId = "";
  let context: Awaited<ReturnType<typeof resolveRunContext>>["context"] | null = null;
  let runState: RunState | null = null;
  let finalized = false;
  const debugEnabled = isChatGenerationDebugEnabled(request.settings);

  const emit = (type: RunEvent["type"], data: any): void => {
    if (!runId) return;
    pendingEvents.push({
      runId,
      seq: ++seq,
      type,
      data,
    } as RunEvent);
  };

  const flushEvents = function* (): Generator<RunEvent> {
    while (pendingEvents.length > 0) {
      const evt = pendingEvents.shift();
      if (!evt) continue;
      yield evt;
    }
  };

  const markPhase = (phase: RunState["phaseReports"][number]["phase"], status: "done" | "failed" | "aborted", startedAt: number, message?: string): void => {
    if (!runState) return;
    runState.phaseReports.push({
      phase,
      status,
      startedAt,
      finishedAt: Date.now(),
      message,
    });
  };

  const emitStateSnapshot = (stage: RunDebugStateSnapshotStage): void => {
    if (!debugEnabled || !runState) return;
    emit("run.debug.state_snapshot", {
      stage,
      basePromptDraft: clonePromptDraftMessages(runState.basePromptDraft),
      effectivePromptDraft: clonePromptDraftMessages(runState.effectivePromptDraft),
      assistantText: runState.assistantText,
      artifacts: mergeArtifactsForDebug(runState.persistedArtifactsSnapshot, runState.runArtifacts),
    });
  };

  try {
    const prepareStartedAt = Date.now();
    const resolved = await resolveRunContext({ request });
    context = resolved.context;
    runId = context.runId;

    registerGeneration(context.generationId, abortController);
    emit("run.started", {
      generationId: context.generationId,
      trigger: context.trigger,
    });

    const persistedArtifactsSnapshot =
      context.sessionKey && context.profileSnapshot
        ? await ProfileSessionArtifactStore.load({
            ownerId: context.ownerId,
            sessionKey: context.sessionKey,
          })
        : {};

    runState = {
      basePromptDraft: [],
      effectivePromptDraft: [],
      llmMessages: [],
      assistantText: "",
      runArtifacts: {},
      persistedArtifactsSnapshot,
      operationResultsByHook: {
        before_main_llm: [],
        after_main_llm: [],
      },
      commitReportsByHook: {},
      phaseReports: [],
      promptHash: null,
      promptSnapshot: null,
      finishedStatus: null,
      failedType: null,
      errorMessage: null,
    };
    markPhase("prepare_run_context", "done", prepareStartedAt);
    yield* flushEvents();

    // build_base_prompt
    emit("run.phase_changed", { phase: "build_base_prompt" });
    const buildStartedAt = Date.now();
    const basePrompt = await buildBasePrompt({
      ownerId: context.ownerId,
      chatId: context.chatId,
      branchId: context.branchId,
      entityProfileId: context.entityProfileId,
      historyLimit: context.historyLimit,
      trigger: context.trigger,
      excludeMessageIds: [request.persistenceTarget.assistantMessageId],
      excludeEntryIds:
        request.persistenceTarget.mode === "entry_parts"
          ? [request.persistenceTarget.assistantEntryId]
          : undefined,
    });
    runState.basePromptDraft = basePrompt.prompt.draftMessages.map((m) => ({ ...m }));
    runState.effectivePromptDraft = basePrompt.prompt.draftMessages.map((m) => ({ ...m }));
    emitStateSnapshot("post_build_base_prompt");
    markPhase("build_base_prompt", "done", buildStartedAt);
    yield* flushEvents();

    const profileOperations = context.profileSnapshot?.operations ?? [];
    const executionMode = context.profileSnapshot?.executionMode ?? "sequential";
    const runArtifactStore = new RunArtifactStore();

    // execute_before_operations
    emit("run.phase_changed", { phase: "execute_before_operations" });
    const execBeforeStartedAt = Date.now();
    runState.operationResultsByHook.before_main_llm = await executeOperationsPhase({
      runId: context.runId,
      hook: "before_main_llm",
      trigger: context.trigger,
      operations: profileOperations,
      executionMode,
      baseMessages: runState.effectivePromptDraft,
      baseArtifacts: mergeArtifacts(runState.persistedArtifactsSnapshot, runState.runArtifacts),
      assistantText: runState.assistantText,
      templateContext: basePrompt.templateContext,
      abortSignal: abortController.signal,
      onOperationStarted: (data) => emit("operation.started", data),
      onOperationFinished: (data) => emit("operation.finished", data),
      onTemplateDebug: debugEnabled
        ? (data) => emit("operation.debug.template", data)
        : undefined,
    });
    markPhase("execute_before_operations", "done", execBeforeStartedAt);
    yield* flushEvents();

    // commit_before_effects
    emit("run.phase_changed", { phase: "commit_before_effects" });
    const commitBeforeStartedAt = Date.now();
    const commitBefore = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: context.ownerId,
      chatId: context.chatId,
      branchId: context.branchId,
      profile: resolved.profile,
      sessionKey: context.sessionKey,
      runState,
      runArtifactStore,
      userTurnTarget: request.userTurnTarget,
      onCommitEvent: (evt) => emit(evt.type, evt.data),
    });
    runState.commitReportsByHook.before_main_llm = commitBefore.report;
    emitStateSnapshot("post_commit_before");
    markPhase(
      "commit_before_effects",
      commitBefore.requiredError ? "failed" : "done",
      commitBeforeStartedAt,
      commitBefore.requiredError ? "required before commit failed" : undefined
    );
    yield* flushEvents();

    // before barrier
    emit("run.phase_changed", { phase: "before_barrier" });
    const barrierStartedAt = Date.now();
    const requiredBeforeNotDone = runState.operationResultsByHook.before_main_llm.filter(
      (item) => item.required && item.status !== "done"
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
    yield* flushEvents();

    if (!beforeBarrierFailed) {
      runState.llmMessages = draftToLlmMessages(runState.effectivePromptDraft);
      runState.promptHash = hashPromptMessages(runState.llmMessages);
      runState.promptSnapshot = buildRedactedSnapshot(runState.llmMessages, {
        historyLimit: context.historyLimit,
        historyReturnedCount: basePrompt.prompt.historyReturnedCount,
      });

      await updateGenerationPromptData({
        id: context.generationId,
        promptHash: runState.promptHash,
        promptSnapshot: runState.promptSnapshot,
      });

      if (debugEnabled && runState.promptHash) {
        emit("run.debug.main_llm_input", {
          promptHash: runState.promptHash,
          basePromptDraft: clonePromptDraftMessages(runState.basePromptDraft),
          effectivePromptDraft: clonePromptDraftMessages(runState.effectivePromptDraft),
          llmMessages: cloneLlmMessages(runState.llmMessages),
        });
      }

      // main llm
      emit("run.phase_changed", { phase: "run_main_llm" });
      emit("main_llm.started", {
        model: context.runtimeInfo.model,
        providerId: context.runtimeInfo.providerId,
      });
      const mainStartedAt = Date.now();
      const main = await runMainLlmPhase({
        request,
        runState,
        ownerId: context.ownerId,
        abortController,
        onDelta: (content) => emit("main_llm.delta", { content }),
      });
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
      yield* flushEvents();

      if (main.status === "aborted") {
        runState.finishedStatus = "aborted";
      } else if (main.status === "error") {
        runState.finishedStatus = "failed";
        runState.failedType = "main_llm";
        runState.errorMessage = main.message ?? "Main LLM failed";
      } else {
        // execute_after_operations
        emit("run.phase_changed", { phase: "execute_after_operations" });
        const executeAfterStartedAt = Date.now();
        const afterBaseMessages = [
          ...runState.effectivePromptDraft.map((m) => ({ ...m })),
          { role: "assistant" as const, content: runState.assistantText },
        ];
        runState.operationResultsByHook.after_main_llm = await executeOperationsPhase({
          runId: context.runId,
          hook: "after_main_llm",
          trigger: context.trigger,
          operations: profileOperations,
          executionMode,
          baseMessages: afterBaseMessages,
          baseArtifacts: mergeArtifacts(runState.persistedArtifactsSnapshot, runState.runArtifacts),
          assistantText: runState.assistantText,
          templateContext: basePrompt.templateContext,
          abortSignal: abortController.signal,
          onOperationStarted: (data) => emit("operation.started", data),
          onOperationFinished: (data) => emit("operation.finished", data),
          onTemplateDebug: debugEnabled
            ? (data) => emit("operation.debug.template", data)
            : undefined,
        });
        markPhase("execute_after_operations", "done", executeAfterStartedAt);
        yield* flushEvents();

        // commit_after_effects
        emit("run.phase_changed", { phase: "commit_after_effects" });
        const commitAfterStartedAt = Date.now();
        const commitAfter = await commitEffectsPhase({
          hook: "after_main_llm",
          ownerId: context.ownerId,
          chatId: context.chatId,
          branchId: context.branchId,
          profile: resolved.profile,
          sessionKey: context.sessionKey,
          runState,
          runArtifactStore,
          userTurnTarget: request.userTurnTarget,
          onCommitEvent: (evt) => emit(evt.type, evt.data),
        });
        runState.commitReportsByHook.after_main_llm = commitAfter.report;
        emitStateSnapshot("post_commit_after");
        markPhase(
          "commit_after_effects",
          commitAfter.requiredError ? "failed" : "done",
          commitAfterStartedAt,
          commitAfter.requiredError ? "required after commit failed" : undefined
        );
        yield* flushEvents();

        const requiredAfterNotDone = runState.operationResultsByHook.after_main_llm.filter(
          (item) => item.required && item.status !== "done"
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
    const result: RunResult = {
      runId: context.runId,
      generationId: context.generationId,
      status: runState.finishedStatus ?? "error",
      failedType: runState.failedType,
      phaseReports: runState.phaseReports,
      commitReportsByHook: runState.commitReportsByHook,
      promptHash: runState.promptHash,
      promptSnapshot: runState.promptSnapshot,
      assistantText: runState.assistantText,
      errorMessage: runState.errorMessage,
    };
    await finalizeRun({ context, result });
    finalized = true;
    emit("run.finished", {
      generationId: context.generationId,
      status: result.status,
      failedType: result.failedType,
      message: result.errorMessage ?? undefined,
    });
    yield* flushEvents();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runState) {
      runState.finishedStatus = abortController.signal.aborted ? "aborted" : "error";
      runState.errorMessage = message;
    }
    if (context && runState && !finalized) {
      const result: RunResult = {
        runId: context.runId,
        generationId: context.generationId,
        status: runState.finishedStatus ?? "error",
        failedType: runState.failedType,
        phaseReports: runState.phaseReports,
        commitReportsByHook: runState.commitReportsByHook,
        promptHash: runState.promptHash,
        promptSnapshot: runState.promptSnapshot,
        assistantText: runState.assistantText,
        errorMessage: message,
      };
      await finalizeRun({ context, result });
      finalized = true;
      emit("run.finished", {
        generationId: context.generationId,
        status: result.status,
        failedType: result.failedType,
        message,
      });
      yield* flushEvents();
    }
  } finally {
    if (context) {
      unregisterGeneration(context.generationId);
    }
  }
}
