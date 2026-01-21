import { HttpError } from "@core/middleware/error-handler";

export type PipelineErrorCode =
  | "pipeline_policy_error"
  | "pipeline_idempotency_conflict"
  | "pipeline_generation_error"
  | "pipeline_artifact_conflict";

export type PipelineClientError = {
  code: PipelineErrorCode;
  message: string;
};

/**
 * Converts unknown errors into a stable pipeline error code + safe client message.
 *
 * IMPORTANT: Do not include secrets or raw stack traces in `message`.
 */
export function normalizePipelineErrorForClient(error: unknown): PipelineClientError {
  if (error instanceof HttpError) {
    const code = typeof error.code === "string" ? error.code : null;
    if (code === "pipeline_policy_error") {
      return { code: "pipeline_policy_error", message: error.message || "Policy error" };
    }
    if (code === "pipeline_artifact_conflict") {
      return { code: "pipeline_artifact_conflict", message: error.message || "Artifact conflict" };
    }
    if (code === "pipeline_idempotency_conflict") {
      return { code: "pipeline_idempotency_conflict", message: error.message || "Idempotency conflict" };
    }
    // Fallback: treat as generation error.
    return { code: "pipeline_generation_error", message: error.message || "Ошибка генерации" };
  }

  return {
    code: "pipeline_generation_error",
    message: "Ошибка генерации",
  };
}

