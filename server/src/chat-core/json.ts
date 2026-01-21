export function safeJsonStringify(value: unknown, fallback = "null"): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

/**
 * Safe JSON stringify with an upper size bound (for logs / debug payloads).
 * If the serialized JSON exceeds maxChars, returns a small JSON object describing truncation.
 */
export function safeJsonStringifyForLog(
  value: unknown,
  opts?: { maxChars?: number; fallback?: string }
): string {
  const maxChars = typeof opts?.maxChars === "number" ? Math.max(256, Math.floor(opts!.maxChars!)) : 20_000;
  const fallback = typeof opts?.fallback === "string" ? opts.fallback : "null";
  const json = safeJsonStringify(value, fallback);
  if (typeof json !== "string" || json.length <= maxChars) return json;

  const previewMax = Math.max(0, maxChars - 200);
  const preview = previewMax > 0 ? `${json.slice(0, previewMax)}…` : "…";
  return safeJsonStringify(
    {
      truncated: true,
      originalChars: json.length,
      maxChars,
      preview,
    },
    fallback
  );
}

export function safeJsonParse<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

