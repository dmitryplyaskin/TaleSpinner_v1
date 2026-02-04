export type OrchestratorErrorCode =
  | "DUPLICATE_TASK_ID"
  | "INVALID_TASK_ORDER"
  | "INVALID_CONCURRENCY"
  | "CYCLE_DETECTED"
  | "DEADLOCK";

export class OrchestratorError extends Error {
  public readonly code: OrchestratorErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: OrchestratorErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

