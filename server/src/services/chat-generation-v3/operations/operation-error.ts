const MAX_OPERATION_ERROR_MESSAGE_LENGTH = 500;
const OPERATION_ERROR_CODE_RE = /^[A-Z][A-Z0-9_]{0,63}$/;

function sanitizeOperationErrorMessage(message: string): string {
  const redacted = message
    .replace(
      /\b(authorization|api[-_ ]?key|token|password|secret)(\s*[:=]\s*)((?:bearer\s+)?[^\s,;]+)/gi,
      "$1$2[REDACTED]"
    )
    .replace(/(bearer\s+)[^\s,;]+/gi, "$1[REDACTED]");
  if (redacted.length <= MAX_OPERATION_ERROR_MESSAGE_LENGTH) return redacted;
  return `${redacted.slice(0, MAX_OPERATION_ERROR_MESSAGE_LENGTH)}...[truncated]`;
}

export function toSafeOperationError(params: {
  code?: string;
  message: string;
  fallbackCode: "OPERATION_ERROR" | "OPERATION_ABORTED";
}): { code: string; message: string } {
  return {
    code:
      params.code && OPERATION_ERROR_CODE_RE.test(params.code)
        ? params.code
        : params.fallbackCode,
    message: sanitizeOperationErrorMessage(params.message),
  };
}
