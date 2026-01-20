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
    // HttpError.message is intended to be client-safe by design in this codebase.
    // Still, keep pipeline code stable for UI.
    return {
      code: "pipeline_generation_error",
      message: error.message || "Ошибка генерации",
    };
  }

  return {
    code: "pipeline_generation_error",
    message: "Ошибка генерации",
  };
}

