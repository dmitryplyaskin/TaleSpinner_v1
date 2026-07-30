import type {
  ArtifactValue,
  CommitPhaseReport,
  OperationExecutionResult,
  PromptDraftMessage,
  RunContext,
  RunDebugStateSnapshotStage,
  RunResult,
  RunState,
} from "../contracts";
import type { GenerateMessage } from "@shared/types/generate";


export function clonePromptDraftMessages(messages: PromptDraftMessage[]): PromptDraftMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export function cloneLlmMessages(messages: GenerateMessage[]): GenerateMessage[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export function mergeArtifacts(
  persisted: RunState["persistedArtifactsSnapshot"],
  runOnly: RunState["runArtifacts"]
): Record<string, { value: unknown; history: unknown[] }> {
  return Object.fromEntries(
    Object.entries({ ...persisted, ...runOnly }).map(([tag, value]) => [
      tag,
      { value: value.value, history: [...value.history] },
    ])
  );
}

export function mergeArtifactsForDebug(
  persisted: RunState["persistedArtifactsSnapshot"],
  runOnly: RunState["runArtifacts"]
): Record<string, ArtifactValue> {
  const merged: Record<string, ArtifactValue> = {};
  for (const [tag, value] of Object.entries(persisted)) {
    merged[tag] = {
      format: value.format,
      semantics: value.semantics,
      persistence: value.persistence,
      writeMode: value.writeMode,
      value: value.value,
      history: [...value.history],
    };
  }
  for (const [tag, value] of Object.entries(runOnly)) {
    merged[tag] = {
      format: value.format,
      semantics: value.semantics,
      persistence: value.persistence,
      writeMode: value.writeMode,
      value: value.value,
      history: [...value.history],
    };
  }
  return merged;
}

export function buildRequiredOperationFailureMessage(params: {
  stage: "before" | "after";
  operationResults: OperationExecutionResult[];
  commitReport: CommitPhaseReport;
  requiredCommitError: boolean;
}): string {
  const operationIds = params.requiredCommitError
    ? params.commitReport.effects
        .filter((effect) => effect.status === "error")
        .map((effect) => effect.opId)
    : params.operationResults.map((result) => result.opId);
  const uniqueOperationIds = Array.from(new Set(operationIds)).sort();
  const baseMessage = params.requiredCommitError
    ? `Required ${params.stage} effect commit failed`
    : `Required ${params.stage} operation did not finish with done`;
  return uniqueOperationIds.length > 0
    ? `${baseMessage}: ${uniqueOperationIds.join(", ")}`
    : baseMessage;
}

export function createInitialRunState(
  persistedArtifactsSnapshot: RunState["persistedArtifactsSnapshot"]
): RunState {
  return {
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
}

export function markRunPhase(
  runState: RunState | null,
  phase: RunState["phaseReports"][number]["phase"],
  status: "done" | "failed" | "aborted",
  startedAt: number,
  message?: string
): void {
  if (!runState) return;
  runState.phaseReports.push({
    phase,
    status,
    startedAt,
    finishedAt: Date.now(),
    message,
  });
}

export function buildRunDebugStateSnapshot(
  runState: RunState,
  stage: RunDebugStateSnapshotStage
): {
  stage: RunDebugStateSnapshotStage;
  basePromptDraft: PromptDraftMessage[];
  effectivePromptDraft: PromptDraftMessage[];
  assistantText: string;
  assistantReasoningText: string;
  artifacts: Record<string, ArtifactValue>;
} {
  return {
    stage,
    basePromptDraft: clonePromptDraftMessages(runState.basePromptDraft),
    effectivePromptDraft: clonePromptDraftMessages(runState.effectivePromptDraft),
    assistantText: runState.assistantText,
    assistantReasoningText: runState.assistantReasoningText,
    artifacts: mergeArtifactsForDebug(runState.persistedArtifactsSnapshot, runState.runArtifacts),
  };
}

export function buildRunResult(params: {
  context: RunContext;
  runState: RunState;
}): RunResult {
  return {
    runId: params.context.runId,
    generationId: params.context.generationId,
    status: params.runState.finishedStatus ?? "error",
    failedType: params.runState.failedType,
    phaseReports: params.runState.phaseReports,
    commitReportsByHook: params.runState.commitReportsByHook,
    promptHash: params.runState.promptHash,
    promptSnapshot: params.runState.promptSnapshot,
    assistantText: params.runState.assistantText,
    errorMessage: params.runState.errorMessage,
  };
}
