import type { GenerateMessage } from "@shared/types/generate";
import type {
  ArtifactExposure,
  ArtifactFormat,
  ArtifactPersistence,
  ArtifactSemantics,
  OperationArtifactConfig,
  OperationHook,
  OperationInProfile,
  OperationProfile,
  OperationTrigger,
} from "@shared/types/operation-profiles";

export type PromptDraftRole = "system" | "user" | "assistant";

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

export type RunPersistenceTarget = {
  mode: "entry_parts";
  assistantEntryId: string;
  assistantMainPartId: string;
  assistantReasoningPartId?: string;
};

export type UserTurnTarget = {
  mode: "entry_parts";
  userEntryId: string;
  userMainPartId: string;
};

export type RunRequest = {
  requestId?: string;
  ownerId?: string;
  chatId: string;
  branchId: string;
  entityProfileId: string;
  trigger: OperationTrigger;
  source: "user_message" | "continue" | "regenerate" | "system_message";
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
  messageNormalization?: {
    enabled: boolean;
    mergeSystem?: boolean;
    mergeConsecutiveAssistant?: boolean;
    separator?: string;
  };
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
  format: ArtifactFormat;
  semantics: ArtifactSemantics;
  persistence: ArtifactPersistence;
  writeMode: "replace" | "append";
  value: unknown;
  history: unknown[];
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
      artifactId: string;
      format: ArtifactFormat;
      persistence: ArtifactPersistence;
      writeMode: "replace" | "append";
      history: {
        enabled: boolean;
        maxItems: number;
      };
      semantics: ArtifactSemantics;
      value: unknown;
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
    }
  | {
      type: "ui.inline";
      opId: string;
      role: PromptDraftRole;
      anchor: "after_last_user" | "depth_from_end";
      depthFromEnd?: number;
      payload: unknown;
      format: ArtifactFormat;
      source?: string;
    };

export type OperationExecutionStatus = "done" | "skipped" | "error" | "aborted";

export type OperationSkipReason =
  | "activation_not_reached"
  | "dependency_not_done"
  | "dependency_missing"
  | "guard_not_matched"
  | "unsupported_kind"
  | "orchestrator_aborted"
  | "filtered_out"
  | "disabled";

export type OperationSkipDetails = {
  activation?: {
    everyNTurns?: number;
    everyNContextTokens?: number;
    turnsCounter: number;
    tokensCounter: number;
  };
  blockedByOpIds?: string[];
  blockedByReason?: "activation_not_reached";
  guard?: {
    sourceOpId: string;
    outputKey: string;
    operator: "is_true" | "is_false";
    actual: boolean | null;
  };
};

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
  skipReason?: OperationSkipReason;
  skipDetails?: OperationSkipDetails;
};

export type OperationFinishedEventData = {
  hook: OperationHook;
  opId: string;
  name: string;
  status: OperationExecutionStatus;
  skipReason?: OperationSkipReason;
  skipDetails?: OperationSkipDetails;
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

export type TurnUserCanonicalizationRecord = {
  hook: OperationHook;
  opId: string;
  userEntryId: string;
  userMainPartId: string;
  replacedPartId?: string;
  canonicalPartId?: string;
  beforeText: string;
  afterText: string;
  committedAt: string;
};

export type TurnAssistantCanonicalizationRecord = {
  hook: OperationHook;
  opId: string;
  assistantEntryId: string;
  assistantMainPartId: string;
  beforeText: string;
  afterText: string;
  committedAt: string;
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
  turnUserCanonicalizationHistory: TurnUserCanonicalizationRecord[];
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
      type: "run.preparation_failed";
      data: {
        generationId: null;
        status: "error";
        code: "generation_preparation_error";
        message: string;
      };
    }
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
        normalizedLlmMessages: GenerateMessage[];
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
      type: "run.debug.turn_user_canonicalization";
      data: TurnUserCanonicalizationRecord;
    }
  | {
      runId: string;
      seq: number;
      type: "run.debug.operation_activation_state_snapshot";
      data: {
        chatId: string;
        branchId: string;
        profileId: string | null;
        operationProfileSessionId: string | null;
        updatedAt: string;
        source: "user_message" | "continue" | "regenerate" | "system_message";
        trigger: OperationTrigger;
        operations: Array<{
          opId: string;
          everyNTurns?: number;
          everyNContextTokens?: number;
          turnsCounter: number;
          tokensCounter: number;
          shouldRunNow: boolean;
          hasActivation: boolean;
          supportsCurrentTrigger: boolean;
        }>;
      };
    }
  | {
      runId: string;
      seq: number;
      type: "turn.assistant.canonicalized";
      data: TurnAssistantCanonicalizationRecord;
    }
  | {
      runId: string;
      seq: number;
      type: "turn.user.canonicalized";
      data: TurnUserCanonicalizationRecord;
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
          promptSystem: string;
          messages: Array<{ role: PromptDraftRole; content: string }>;
          art: Record<string, { value: unknown; history: unknown[] }>;
          artByOpId?: Record<string, { value: unknown; history: unknown[] }>;
        };
      };
    };

function valueToText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function mapArtifactExposureToEffectTypes(
  artifact: OperationArtifactConfig
): RuntimeEffect["type"][] {
  const effectTypes: RuntimeEffect["type"][] = ["artifact.upsert"];
  for (const exposure of artifact.exposures) {
    if (exposure.type === "prompt_part") {
      effectTypes.push("prompt.system_update");
      continue;
    }
    if (exposure.type === "prompt_message") {
      effectTypes.push(
        exposure.anchor === "after_last_user"
          ? "prompt.append_after_last_user"
          : "prompt.insert_at_depth"
      );
      continue;
    }
    if (exposure.type === "turn_rewrite") {
      effectTypes.push(
        exposure.target === "assistant_output_main"
          ? "turn.assistant.replace_text"
          : "turn.user.replace_text"
      );
      continue;
    }
    effectTypes.push("ui.inline");
  }
  return effectTypes;
}

export function getArtifactPrimaryEffectType(
  artifact: OperationArtifactConfig
): RuntimeEffect["type"] {
  return mapArtifactExposureToEffectTypes(artifact)[0] ?? "artifact.upsert";
}

export function compileArtifactExposureEffect(params: {
  opId: string;
  artifact: OperationArtifactConfig;
  exposure: ArtifactExposure;
  value: unknown;
}): RuntimeEffect {
  const { opId, artifact, exposure, value } = params;
  if (exposure.type === "prompt_part") {
    return {
      type: "prompt.system_update",
      opId,
      mode: exposure.mode,
      payload: valueToText(value),
      source: exposure.source,
    };
  }
  if (exposure.type === "prompt_message") {
    if (exposure.anchor === "after_last_user") {
      return {
        type: "prompt.append_after_last_user",
        opId,
        role: exposure.role,
        payload: valueToText(value),
        source: exposure.source,
      };
    }
    return {
      type: "prompt.insert_at_depth",
      opId,
      role: exposure.role,
      depthFromEnd: exposure.depthFromEnd,
      payload: valueToText(value),
      source: exposure.source,
    };
  }
  if (exposure.type === "turn_rewrite") {
    const text = valueToText(value);
    return exposure.target === "assistant_output_main"
      ? { type: "turn.assistant.replace_text", opId, text }
      : { type: "turn.user.replace_text", opId, text };
  }
  return {
    type: "ui.inline",
    opId,
    role: exposure.role,
    anchor: exposure.anchor,
    depthFromEnd: exposure.anchor === "depth_from_end" ? exposure.depthFromEnd : undefined,
    payload: value,
    format: artifact.format,
    source: exposure.source,
  };
}

