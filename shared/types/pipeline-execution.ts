export type PipelineTrigger = "user_message" | "regenerate" | "manual" | "api";

export type PipelineRunStatus = "running" | "done" | "aborted" | "error";

export type PipelineStepType = "pre" | "llm" | "post";

export type PipelineStepStatus = "running" | "done" | "aborted" | "error";

export type GenerationStatus = "streaming" | "done" | "aborted" | "error";

// v1 stable error codes (used by UI without parsing free-form text)
export type PipelineErrorCode =
  | "pipeline_policy_error"
  | "pipeline_idempotency_conflict"
  | "pipeline_generation_error"
  | "pipeline_artifact_conflict";

export type PromptDraftRole = "system" | "user" | "assistant";

export type PromptDraftMessage = {
  role: PromptDraftRole;
  content: string;
};

export type PromptDraft = {
  messages: PromptDraftMessage[];
};

export type PipelineRun = {
  id: string;
  ownerId: string;
  chatId: string;
  entityProfileId: string;

  // v1: stored for recovery/debug; artifacts are chat-scoped, but run still has branch correlation.
  branchId: string | null;

  // v1: stable dedup key for client retries (optional).
  idempotencyKey: string | null;

  trigger: PipelineTrigger;
  status: PipelineRunStatus;

  startedAt: string;
  finishedAt: string | null;

  // Correlation ids for reconstruction and idempotency.
  userMessageId: string | null;
  assistantMessageId: string | null;
  assistantVariantId: string | null;
  generationId: string | null;

  meta: unknown | null;
};

export type PipelineStepRun = {
  id: string;
  ownerId: string;
  runId: string;

  stepName: string;
  stepType: PipelineStepType;
  status: PipelineStepStatus;

  startedAt: string;
  finishedAt: string | null;

  input: unknown | null;
  output: unknown | null;

  // v1: prefer stable error codes; message is optional and must be safe for clients.
  errorCode: PipelineErrorCode | string | null;
  errorMessage: string | null;
};

export type Generation = {
  id: string;
  ownerId: string;
  chatId: string;
  branchId: string | null;

  // v1: "messageId" is assistant message id; variantId may be null (implementation detail).
  messageId: string;
  variantId: string | null;

  pipelineRunId: string | null;
  pipelineStepRunId: string | null;

  providerId: string;
  model: string;
  params: Record<string, unknown>;

  status: GenerationStatus;

  startedAt: string;
  finishedAt: string | null;

  promptHash: string | null;
  promptSnapshot: unknown | null;

  promptTokens: number | null;
  completionTokens: number | null;

  error: string | null;
};

