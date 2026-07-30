import { commitEffectsPhase } from "../operations/commit-effects-phase";
import { executeOperationsPhase } from "../operations/execute-operations-phase";

import type { EmitRunEvent, StreamEventsWhile } from "./run-event-stream";
import type { RunArtifactStore } from "../artifacts/run-artifact-store";
import type {
  OperationSkipDetails,
  RunDebugStateSnapshotStage,
  RunEvent,
  RunPersistenceTarget,
  RunState,
  UserTurnTarget,
 PromptDraftMessage } from "../contracts";
import type {
  OperationHook,
  OperationInProfile,
  OperationProfile,
} from "@shared/types/operation-profiles";

type ExecuteOperationHookPhaseParams = {
  hook: OperationHook;
  runId: string;
  trigger: "generate" | "regenerate";
  operations: OperationInProfile[];
  activationSkippedByOpId: ReadonlyMap<string, NonNullable<OperationSkipDetails["activation"]>>;
  executionMode: "concurrent" | "sequential";
  baseMessages: PromptDraftMessage[];
  baseArtifacts: Record<string, { value: unknown; history: unknown[] }>;
  assistantText: string;
  templateContext: {
    char: unknown;
    user: unknown;
    chat: unknown;
    messages: Array<{ role: string; content: string }>;
    rag: unknown;
    art?: Record<string, unknown>;
    now: string;
  };
  abortSignal: AbortSignal;
  runState: RunState;
  runArtifactStore: RunArtifactStore;
  ownerId: string;
  chatId: string;
  branchId: string;
  profile: OperationProfile | null;
  sessionKey: string | null;
  persistenceTarget: RunPersistenceTarget;
  userTurnTarget?: UserTurnTarget;
  debugEnabled: boolean;
  emit: EmitRunEvent;
  streamEventsWhile: StreamEventsWhile;
  markPhase: (
    phase: RunState["phaseReports"][number]["phase"],
    status: "done" | "failed" | "aborted",
    startedAt: number,
    message?: string
  ) => void;
  executePhaseName: RunState["phaseReports"][number]["phase"];
  commitPhaseName: RunState["phaseReports"][number]["phase"];
  requiredCommitErrorMessage?: string;
  stateSnapshotStage?: RunDebugStateSnapshotStage;
  emitStateSnapshot: (stage: RunDebugStateSnapshotStage) => void;
};

export async function* runOperationHookPhase(
  params: ExecuteOperationHookPhaseParams
): AsyncGenerator<RunEvent, Awaited<ReturnType<typeof commitEffectsPhase>>> {
  params.emit("run.phase_changed", { phase: params.executePhaseName });
  const executeStartedAt = Date.now();
  params.runState.operationResultsByHook[params.hook] = yield* params.streamEventsWhile(
    executeOperationsPhase({
      runId: params.runId,
      hook: params.hook,
      trigger: params.trigger,
      operations: params.operations,
      activationSkippedByOpId: params.activationSkippedByOpId,
      executionMode: params.executionMode,
      baseMessages: params.baseMessages,
      baseArtifacts: params.baseArtifacts,
      assistantText: params.assistantText,
      templateContext: params.templateContext,
      knowledgeContext: {
        ownerId: params.ownerId,
        chatId: params.chatId,
        branchId: params.branchId,
      },
      abortSignal: params.abortSignal,
      onOperationStarted: (data) => params.emit("operation.started", data),
      onOperationFinished: (data) => params.emit("operation.finished", data),
      onTemplateDebug: params.debugEnabled
        ? (data) => params.emit("operation.debug.template", data)
        : undefined,
    })
  );
  params.markPhase(params.executePhaseName, "done", executeStartedAt);

  params.emit("run.phase_changed", { phase: params.commitPhaseName });
  const commitStartedAt = Date.now();
  const commitResult = yield* params.streamEventsWhile(
    commitEffectsPhase({
      hook: params.hook,
      ownerId: params.ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      profile: params.profile,
      sessionKey: params.sessionKey,
      runState: params.runState,
      runArtifactStore: params.runArtifactStore,
      persistenceTarget: params.persistenceTarget,
      userTurnTarget: params.userTurnTarget,
      onAssistantTurnCanonicalized: (data) => {
        params.emit("turn.assistant.canonicalized", data);
      },
      onUserTurnCanonicalized: (data) => {
        params.emit("turn.user.canonicalized", data);
        if (params.debugEnabled) {
          params.emit("run.debug.turn_user_canonicalization", data);
        }
      },
      onCommitEvent: (evt) => params.emit(evt.type, evt.data),
    })
  );
  params.runState.commitReportsByHook[params.hook] = commitResult.report;
  if (params.stateSnapshotStage) {
    params.emitStateSnapshot(params.stateSnapshotStage);
  }
  params.markPhase(
    params.commitPhaseName,
    commitResult.requiredError ? "failed" : "done",
    commitStartedAt,
    commitResult.requiredError ? params.requiredCommitErrorMessage : undefined
  );

  return commitResult;
}
