import crypto from "crypto";

import { unregisterGeneration, registerGeneration } from "../chat-core/generation-runtime";
import {
  updateGenerationDebugJson,
  updateGenerationPromptData,
} from "../chat-core/generations-repository";

import { ProfileSessionArtifactStore } from "./artifacts/profile-session-artifact-store";
import { RunArtifactStore } from "./artifacts/run-artifact-store";
import { isChatGenerationDebugEnabled } from "./debug";
import { runMainLlmPhase } from "./main-llm/run-main-llm-phase";
import { commitEffectsPhase } from "./operations/commit-effects-phase";
import { executeOperationsPhase } from "./operations/execute-operations-phase";
import { finalizeRun } from "./persist/finalize-run";
import { resolveRunContext } from "./prepare/resolve-run-context";
import { buildBasePrompt } from "./prompt/build-base-prompt";

import type {
  ArtifactValue,
  PromptDraftMessage,
  PromptSnapshotV1,
  RunEvent,
  RunDebugStateSnapshotStage,
  RunRequest,
  RunResult,
  RunState,
  TurnUserCanonicalizationRecord,
} from "./contracts";
import type { GenerateMessage } from "@shared/types/generate";

type PromptDiagnosticsSectionTokens = {
  systemInstruction: number;
  chatHistory: number;
  worldInfoBefore: number;
  worldInfoAfter: number;
  worldInfoDepth: number;
  worldInfoOutlets: number;
  worldInfoAN: number;
  worldInfoEM: number;
};

type PromptDiagnosticsDebugJson = {
  estimator: "chars_div4";
  prompt: {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    approxTokens: {
      total: number;
      byRole: { system: number; user: number; assistant: number };
      sections: PromptDiagnosticsSectionTokens;
    };
  };
  worldInfo: {
    activatedCount: number;
    warnings: string[];
    entries: Array<{
      hash: string;
      bookId: string;
      bookName: string;
      uid: number;
      comment: string;
      content: string;
      matchedKeys: string[];
      reasons: string[];
    }>;
  };
  operations: {
    turnUserCanonicalization: TurnUserCanonicalizationRecord[];
  };
};

function draftToLlmMessages(draft: PromptDraftMessage[]): GenerateMessage[] {
  return draft
    .map((m) => ({ role: m.role as GenerateMessage["role"], content: m.content.trim() }))
    .filter((m) => m.content.length > 0);
}

function hashPromptMessages(messages: GenerateMessage[]): string {
  return crypto.createHash("sha256").update(JSON.stringify(messages)).digest("hex");
}

function buildRedactedSnapshot(
  messages: GenerateMessage[],
  params: {
    historyLimit: number;
    historyReturnedCount: number;
    worldInfoMeta?: PromptSnapshotV1["meta"]["worldInfo"];
  }
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
      worldInfo: params.worldInfoMeta,
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

function approxTokensByChars(chars: number): number {
  if (!Number.isFinite(chars)) return 0;
  const normalized = Math.max(0, Math.floor(chars));
  if (normalized === 0) return 0;
  return Math.ceil(normalized / 4);
}

function approxTokensByText(text: string): number {
  return approxTokensByChars(String(text ?? "").length);
}

function sumTextLengths(values: string[]): number {
  return values.reduce((acc, value) => acc + String(value ?? "").length, 0);
}

function buildPromptDiagnosticsDebugJson(params: {
  llmMessages: GenerateMessage[];
  systemPrompt: string;
  templateHistoryMessages: Array<{ role: string; content: string }>;
  worldInfoDiagnostics: Awaited<ReturnType<typeof buildBasePrompt>>["worldInfoDiagnostics"];
  turnUserCanonicalization: TurnUserCanonicalizationRecord[];
}): PromptDiagnosticsDebugJson {
  const byRole = params.llmMessages.reduce(
    (acc, message) => {
      const tokens = approxTokensByText(message.content);
      if (message.role === "system") acc.system += tokens;
      if (message.role === "user") acc.user += tokens;
      if (message.role === "assistant") acc.assistant += tokens;
      return acc;
    },
    { system: 0, user: 0, assistant: 0 }
  );
  const total = byRole.system + byRole.user + byRole.assistant;

  const worldInfoDepthChars = params.worldInfoDiagnostics.depthEntries.reduce(
    (acc, item) => acc + String(item.content ?? "").length,
    0
  );
  const worldInfoOutletChars = Object.values(
    params.worldInfoDiagnostics.outletEntries
  ).reduce((acc, entries) => acc + sumTextLengths(entries), 0);
  const worldInfoAnChars =
    sumTextLengths(params.worldInfoDiagnostics.anTop) +
    sumTextLengths(params.worldInfoDiagnostics.anBottom);
  const worldInfoEmChars =
    sumTextLengths(params.worldInfoDiagnostics.emTop) +
    sumTextLengths(params.worldInfoDiagnostics.emBottom);
  const chatHistoryChars = params.templateHistoryMessages.reduce(
    (acc, item) => acc + String(item.content ?? "").length,
    0
  );

  const sections: PromptDiagnosticsSectionTokens = {
    systemInstruction: approxTokensByText(params.systemPrompt),
    chatHistory: approxTokensByChars(chatHistoryChars),
    worldInfoBefore: approxTokensByText(params.worldInfoDiagnostics.worldInfoBefore),
    worldInfoAfter: approxTokensByText(params.worldInfoDiagnostics.worldInfoAfter),
    worldInfoDepth: approxTokensByChars(worldInfoDepthChars),
    worldInfoOutlets: approxTokensByChars(worldInfoOutletChars),
    worldInfoAN: approxTokensByChars(worldInfoAnChars),
    worldInfoEM: approxTokensByChars(worldInfoEmChars),
  };

  return {
    estimator: "chars_div4",
    prompt: {
      messages: cloneLlmMessages(params.llmMessages),
      approxTokens: {
        total,
        byRole,
        sections,
      },
    },
    worldInfo: {
      activatedCount: params.worldInfoDiagnostics.activatedCount,
      warnings: [...params.worldInfoDiagnostics.warnings],
      entries: params.worldInfoDiagnostics.activatedEntries.map((entry) => ({
        hash: entry.hash,
        bookId: entry.bookId,
        bookName: entry.bookName,
        uid: entry.uid,
        comment: entry.comment,
        content: entry.content,
        matchedKeys: [...entry.matchedKeys],
        reasons: [...entry.reasons],
      })),
    },
    operations: {
      turnUserCanonicalization: params.turnUserCanonicalization.map((record) => ({
        ...record,
      })),
    },
  };
}

export async function* runChatGenerationV3(
  request: RunRequest
): AsyncGenerator<RunEvent> {
  const abortController = request.abortController ?? new AbortController();
  const pendingEvents: RunEvent[] = [];
  const waiters: Array<() => void> = [];
  let seq = 0;
  let runId = "";
  let context: Awaited<ReturnType<typeof resolveRunContext>>["context"] | null = null;
  let runState: RunState | null = null;
  let finalized = false;
  const debugEnabled = isChatGenerationDebugEnabled(request.settings);

  const notifyWaiters = (): void => {
    if (waiters.length === 0) return;
    const queued = waiters.splice(0, waiters.length);
    for (const wake of queued) wake();
  };

  const waitForSignal = (): Promise<void> =>
    new Promise((resolve) => {
      waiters.push(resolve);
    });

  const emit = (type: RunEvent["type"], data: any): void => {
    if (!runId) return;
    pendingEvents.push({
      runId,
      seq: ++seq,
      type,
      data,
    } as RunEvent);
    notifyWaiters();
  };

  const flushEvents = function* (): Generator<RunEvent> {
    while (pendingEvents.length > 0) {
      const evt = pendingEvents.shift();
      if (!evt) continue;
      yield evt;
    }
  };

  const streamEventsWhile = async function* <T>(
    work: Promise<T>
  ): AsyncGenerator<RunEvent, T> {
    let settled = false;
    let result: T | undefined;
    let failure: unknown;

    work.then(
      (value) => {
        result = value;
        settled = true;
        notifyWaiters();
      },
      (error) => {
        failure = error;
        settled = true;
        notifyWaiters();
      }
    );

    while (!settled || pendingEvents.length > 0) {
      if (pendingEvents.length > 0) {
        yield* flushEvents();
        continue;
      }
      await waitForSignal();
    }

    if (failure) throw failure;
    return result as T;
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
      assistantReasoningText: runState.assistantReasoningText,
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
      assistantReasoningText: "",
      runArtifacts: {},
      persistedArtifactsSnapshot,
      operationResultsByHook: {
        before_main_llm: [],
        after_main_llm: [],
      },
      commitReportsByHook: {},
      turnUserCanonicalizationHistory: [],
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
      scanSeed: context.generationId,
      excludeEntryIds: [request.persistenceTarget.assistantEntryId],
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
    runState.operationResultsByHook.before_main_llm = yield* streamEventsWhile(
      executeOperationsPhase({
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
      })
    );
    markPhase("execute_before_operations", "done", execBeforeStartedAt);
    yield* flushEvents();

    // commit_before_effects
    emit("run.phase_changed", { phase: "commit_before_effects" });
    const commitBeforeStartedAt = Date.now();
    const commitBefore = yield* streamEventsWhile(
      commitEffectsPhase({
        hook: "before_main_llm",
        ownerId: context.ownerId,
        chatId: context.chatId,
        branchId: context.branchId,
        profile: resolved.profile,
        sessionKey: context.sessionKey,
        runState,
        runArtifactStore,
        userTurnTarget: request.userTurnTarget,
        onUserTurnCanonicalized: debugEnabled
          ? (data) => emit("run.debug.turn_user_canonicalization", data)
          : undefined,
        onCommitEvent: (evt) => emit(evt.type, evt.data),
      })
    );
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

    runState.llmMessages = draftToLlmMessages(runState.effectivePromptDraft);
    runState.promptHash = hashPromptMessages(runState.llmMessages);
    runState.promptSnapshot = buildRedactedSnapshot(runState.llmMessages, {
      historyLimit: context.historyLimit,
      historyReturnedCount: basePrompt.prompt.historyReturnedCount,
      worldInfoMeta: basePrompt.prompt.promptSnapshot.meta.worldInfo,
    });

    await updateGenerationPromptData({
      id: context.generationId,
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
    await updateGenerationDebugJson({
      id: context.generationId,
      debug: promptDiagnosticsDebug,
    });

    if (debugEnabled && runState.promptHash) {
      emit("run.debug.main_llm_input", {
        promptHash: runState.promptHash,
        basePromptDraft: clonePromptDraftMessages(runState.basePromptDraft),
        effectivePromptDraft: clonePromptDraftMessages(runState.effectivePromptDraft),
        llmMessages: cloneLlmMessages(runState.llmMessages),
      });
    }

    if (!beforeBarrierFailed) {

      // main llm
      emit("run.phase_changed", { phase: "run_main_llm" });
      emit("main_llm.started", {
        model: context.runtimeInfo.model,
        providerId: context.runtimeInfo.providerId,
      });
      const mainStartedAt = Date.now();
      const main = yield* streamEventsWhile(
        runMainLlmPhase({
          request,
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
        runState.operationResultsByHook.after_main_llm = yield* streamEventsWhile(
          executeOperationsPhase({
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
          })
        );
        markPhase("execute_after_operations", "done", executeAfterStartedAt);
        yield* flushEvents();

        // commit_after_effects
        emit("run.phase_changed", { phase: "commit_after_effects" });
        const commitAfterStartedAt = Date.now();
        const commitAfter = yield* streamEventsWhile(
          commitEffectsPhase({
            hook: "after_main_llm",
            ownerId: context.ownerId,
            chatId: context.chatId,
            branchId: context.branchId,
            profile: resolved.profile,
            sessionKey: context.sessionKey,
            runState,
            runArtifactStore,
            userTurnTarget: request.userTurnTarget,
            onUserTurnCanonicalized: debugEnabled
              ? (data) => emit("run.debug.turn_user_canonicalization", data)
              : undefined,
            onCommitEvent: (evt) => emit(evt.type, evt.data),
          })
        );
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
