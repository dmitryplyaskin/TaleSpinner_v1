export function safeJsonStringify(value: unknown, fallback = "null"): string {
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

export function safeJsonParse<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (typeof value !== "string" || !value.trim()) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

