export type JsonResponse<T = unknown> = {
  status: number;
  data: T;
};

export async function requestJson<T = unknown>(params: {
  baseUrl: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
}): Promise<JsonResponse<T>> {
  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: params.method,
    headers: {
      ...(params.body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(params.headers ?? {}),
    },
    body: params.body === undefined ? undefined : JSON.stringify(params.body),
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    data: payload as T,
  };
}

export async function requestForm<T = unknown>(params: {
  baseUrl: string;
  method: "POST" | "PUT" | "PATCH";
  path: string;
  form: FormData;
  headers?: Record<string, string>;
}): Promise<JsonResponse<T>> {
  const response = await fetch(`${params.baseUrl}${params.path}`, {
    method: params.method,
    headers: {
      ...(params.headers ?? {}),
    },
    body: params.form,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    data: payload as T,
  };
}

export type SseEvent = {
  event: string;
  data: unknown;
};

function parseSseBlock(block: string): SseEvent | null {
  const lines = block
    .split("\n")
    .map((line) => line.trimEnd())
    .filter((line) => line.length > 0 && !line.startsWith(":"));

  if (lines.length === 0) return null;

  let event = "message";
  const dataParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataParts.push(line.slice(5).trim());
    }
  }

  const rawData = dataParts.join("\n");
  if (rawData.length === 0) return null;
  if (rawData === "[DONE]") return { event, data: rawData };

  try {
    return { event, data: JSON.parse(rawData) as unknown };
  } catch {
    return { event, data: rawData };
  }
}

export async function collectSse(params: {
  baseUrl: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  onEvent?: (event: SseEvent) => Promise<void> | void;
  stopWhen?: (event: SseEvent) => boolean;
  timeoutMs?: number;
}): Promise<SseEvent[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs ?? 30_000);

  try {
    const response = await fetch(`${params.baseUrl}${params.path}`, {
      method: params.body === undefined ? "GET" : "POST",
      headers: {
        Accept: "text/event-stream",
        ...(params.body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(params.headers ?? {}),
      },
      body: params.body === undefined ? undefined : JSON.stringify(params.body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE request failed with status ${response.status}`);
    }

    if (!response.body) {
      throw new Error("SSE response body is empty");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const events: SseEvent[] = [];
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf("\n\n");
      while (separatorIndex >= 0) {
        const block = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        separatorIndex = buffer.indexOf("\n\n");

        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        events.push(parsed);
        if (params.onEvent) {
          await params.onEvent(parsed);
        }
        if (params.stopWhen?.(parsed)) {
          controller.abort();
          return events;
        }
      }
    }

    return events;
  } finally {
    clearTimeout(timeout);
  }
}
