import type { GenerateMessage } from "@shared/types/generate";
import type {
  ArtifactPersistence,
  ArtifactSemantics,
  ArtifactUsage,
  OperationHook,
  OperationInProfile,
  OperationOutput,
  OperationProfile,
  OperationTrigger,
} from "@shared/types/operation-profiles";

export type PromptDraftRole = "system" | "developer" | "user" | "assistant";

export type PromptDraftMessage = {
  role: PromptDraftRole;
  content: string;
};

export type PromptSnapshotV1 = {
  v: 1;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  truncated: boolean;
  meta: {
    historyLimit: number;
    historyReturnedCount: number;
    worldInfo?: {
      activatedCount: number;
      beforeChars: number;
      afterChars: number;
      warnings: string[];
    };
  };
};

export type RunPersistenceTarget =
  {
    mode: "entry_parts";
    assistantEntryId: string;
    assistantMainPartId: string;
    assistantReasoningPartId?: string;
  };

export type UserTurnTarget =
  {
    mode: "entry_parts";
    userEntryId: string;
    userMainPartId: string;
  };

export type RunRequest = {
  ownerId?: string;
  chatId: string;
  branchId: string;
  entityProfileId: string;
  trigger: OperationTrigger;
  settings: Record<string, unknown>;
  persistenceTarget: RunPersistenceTarget;
  userTurnTarget?: UserTurnTarget;
  historyLimit?: number;
  flushMs?: number;
  abortController?: AbortController;
};

export type ProfileSnapshot = {
  profileId: string;
  version: number;
  executionMode: OperationProfile["executionMode"];
  operationProfileSessionId: string;
  operations: OperationInProfile[];
} | null;

export type RuntimeInfoSnapshot = {
  providerId: string;
  model: string;
};

export type RunContext = {
  ownerId: string;
  runId: string;
  generationId: string;
  trigger: OperationTrigger;
  chatId: string;
  branchId: string;
  entityProfileId: string;
  profileSnapshot: ProfileSnapshot;
  runtimeInfo: RuntimeInfoSnapshot;
  sessionKey: string | null;
  historyLimit: number;
  startedAt: number;
};

export type ArtifactValue = {
  usage: ArtifactUsage;
  semantics: ArtifactSemantics;
  persistence: ArtifactPersistence;
  value: string;
  history: string[];
};

export type PromptBuildOutput = {
  systemPrompt: string;
  historyReturnedCount: number;
  promptHash: string;
  promptSnapshot: PromptSnapshotV1;
  llmMessages: GenerateMessage[];
  draftMessages: PromptDraftMessage[];
};

export type RuntimeEffect =
  | {
      type: "prompt.system_update";
      opId: string;
      mode: "prepend" | "append" | "replace";
      payload: string;
      source?: string;
    }
  | {
      type: "prompt.append_after_last_user";
      opId: string;
      role: PromptDraftRole;
      payload: string;
      source?: string;
    }
  | {
      type: "prompt.insert_at_depth";
      opId: string;
      role: PromptDraftRole;
      depthFromEnd: number;
      payload: string;
      source?: string;
    }
  | {
      type: "artifact.upsert";
      opId: string;
      tag: string;
      persistence: ArtifactPersistence;
      usage: ArtifactUsage;
      semantics: ArtifactSemantics;
      value: string;
    }
  | {
      type: "turn.user.replace_text";
      opId: string;
      text: string;
    }
  | {
      type: "turn.assistant.replace_text";
      opId: string;
      text: string;
    };

export type OperationExecutionStatus = "done" | "skipped" | "error" | "aborted";

export type OperationExecutionResult = {
  opId: string;
  name: string;
  required: boolean;
  hook: OperationHook;
  status: OperationExecutionStatus;
  order: number;
  dependsOn: string[];
  effects: RuntimeEffect[];
  debugSummary?: string;
  error?: {
    code: string;
    message: string;
  };
  skipReason?: string;
};

export type OperationFinishedEventData = {
  hook: OperationHook;
  opId: string;
  name: string;
  status: OperationExecutionStatus;
  skipReason?: string;
  error?: { code: string; message: string };
  result?: {
    effects: RuntimeEffect[];
    debugSummary?: string;
  };
};

export type CommitEffectReport = {
  opId: string;
  effectType: RuntimeEffect["type"];
  status: "applied" | "skipped" | "error";
  message?: string;
};

export type CommitPhaseReport = {
  hook: OperationHook;
  status: "done" | "error";
  effects: CommitEffectReport[];
};

export type PhaseReport = {
  phase:
    | "prepare_run_context"
    | "build_base_prompt"
    | "execute_before_operations"
    | "commit_before_effects"
    | "before_barrier"
    | "run_main_llm"
    | "execute_after_operations"
    | "commit_after_effects"
    | "persist_finalize";
  status: "done" | "failed" | "aborted";
  startedAt: number;
  finishedAt: number;
  message?: string;
};

export type RunState = {
  basePromptDraft: PromptDraftMessage[];
  effectivePromptDraft: PromptDraftMessage[];
  llmMessages: GenerateMessage[];
  assistantText: string;
  assistantReasoningText: string;
  runArtifacts: Record<string, ArtifactValue>;
  persistedArtifactsSnapshot: Record<string, ArtifactValue>;
  operationResultsByHook: Record<OperationHook, OperationExecutionResult[]>;
  commitReportsByHook: Partial<Record<OperationHook, CommitPhaseReport>>;
  phaseReports: PhaseReport[];
  promptHash: string | null;
  promptSnapshot: PromptSnapshotV1 | null;
  finishedStatus: "done" | "failed" | "aborted" | "error" | null;
  failedType: "before_barrier" | "main_llm" | "after_main_llm" | null;
  errorMessage: string | null;
};

export type RunResult = {
  runId: string;
  generationId: string;
  status: "done" | "failed" | "aborted" | "error";
  failedType: "before_barrier" | "main_llm" | "after_main_llm" | null;
  phaseReports: PhaseReport[];
  commitReportsByHook: Partial<Record<OperationHook, CommitPhaseReport>>;
  promptHash: string | null;
  promptSnapshot: PromptSnapshotV1 | null;
  assistantText: string;
  errorMessage: string | null;
};

export type RunDebugStateSnapshotStage =
  | "post_build_base_prompt"
  | "post_commit_before"
  | "post_main_llm"
  | "post_commit_after";

export type RunEvent =
  | {
      runId: string;
      seq: number;
      type: "run.started";
      data: { generationId: string; trigger: OperationTrigger };
    }
  | {
      runId: string;
      seq: number;
      type: "run.phase_changed";
      data: { phase: PhaseReport["phase"] };
    }
  | {
      runId: string;
      seq: number;
      type: "operation.started";
      data: { hook: OperationHook; opId: string; name: string };
    }
  | {
      runId: string;
      seq: number;
      type: "operation.finished";
      data: OperationFinishedEventData;
    }
  | {
      runId: string;
      seq: number;
      type: "commit.effect_applied" | "commit.effect_skipped" | "commit.effect_error";
      data: {
        hook: OperationHook;
        opId: string;
        effectType: RuntimeEffect["type"];
        message?: string;
      };
    }
  | {
      runId: string;
      seq: number;
      type: "main_llm.started";
      data: { model: string; providerId: string };
    }
  | {
      runId: string;
      seq: number;
      type: "main_llm.delta";
      data: { content: string };
    }
  | {
      runId: string;
      seq: number;
      type: "main_llm.reasoning_delta";
      data: { content: string };
    }
  | {
      runId: string;
      seq: number;
      type: "main_llm.finished";
      data: {
        status: "done" | "aborted" | "error";
        message?: string;
      };
    }
  | {
      runId: string;
      seq: number;
      type: "run.finished";
      data: {
        generationId: string;
        status: "done" | "failed" | "aborted" | "error";
        failedType: "before_barrier" | "main_llm" | "after_main_llm" | null;
        message?: string;
      };
    }
  | {
      runId: string;
      seq: number;
      type: "run.debug.main_llm_input";
      data: {
        promptHash: string;
        basePromptDraft: PromptDraftMessage[];
        effectivePromptDraft: PromptDraftMessage[];
        llmMessages: GenerateMessage[];
      };
    }
  | {
      runId: string;
      seq: number;
      type: "run.debug.state_snapshot";
      data: {
        stage: RunDebugStateSnapshotStage;
        basePromptDraft: PromptDraftMessage[];
        effectivePromptDraft: PromptDraftMessage[];
        assistantText: string;
        assistantReasoningText: string;
        artifacts: Record<string, ArtifactValue>;
      };
    }
  | {
      runId: string;
      seq: number;
      type: "operation.debug.template";
      data: {
        hook: OperationHook;
        opId: string;
        name: string;
        template: string;
        rendered: string;
        effect: RuntimeEffect;
        liquidContext: {
          char: unknown;
          user: unknown;
          chat: unknown;
          rag: unknown;
          now: string;
          messages: Array<{ role: PromptDraftRole; content: string }>;
          art: Record<string, { value: string; history: string[] }>;
        };
      };
    };

export function mapOperationOutputToEffectType(output: OperationOutput): RuntimeEffect["type"] {
  if (output.type === "artifacts") return "artifact.upsert";
  if (output.type === "turn_canonicalization") {
    return output.canonicalization.target === "assistant"
      ? "turn.assistant.replace_text"
      : "turn.user.replace_text";
  }
  if (output.promptTime.kind === "system_update") return "prompt.system_update";
  if (output.promptTime.kind === "append_after_last_user") return "prompt.append_after_last_user";
  return "prompt.insert_at_depth";
}
