import { type Response } from "express";

export type SseEnvelope<T = unknown> = {
  id: string;
  type: string;
  ts: number;
  data: T;
};

export type SseWriter = {
  /**
   * Sends an SSE event envelope as JSON.
   * Uses `event:` for `type` to enable client-side filtering.
   */
  send: <T>(type: string, data: T) => void;
  /** Sends a low-cost heartbeat comment (does not trigger message listeners). */
  heartbeat: () => void;
  /** Ends connection and stops heartbeats. */
  close: () => void;
};

function nowMs(): number {
  return Date.now();
}

function writeEvent(res: Response, type: string, payload: string): void {
  // Note: SSE requires LF; keep it explicit.
  res.write(`event: ${type}\n`);
  res.write(`data: ${payload}\n\n`);
}

/**
 * Initializes an SSE response and returns a writer.
 *
 * Safe to call only once per request.
 */
export function initSse(params: {
  res: Response;
  heartbeatMs?: number;
}): SseWriter {
  const res = params.res;
  const heartbeatMs = params.heartbeatMs ?? 15_000;

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Disable proxy buffering where possible (harmless elsewhere).
  res.setHeader("X-Accel-Buffering", "no");

  let seq = 0;
  let closed = false;

  const heartbeatTimer = setInterval(() => {
    if (closed) return;
    // Comment line: clients ignore it, but it keeps connection alive.
    res.write(`: ping ${nowMs()}\n\n`);
  }, heartbeatMs);

  const close = (): void => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeatTimer);
    try {
      res.end();
    } catch {
      // ignore
    }
  };

  const send = <T,>(type: string, data: T): void => {
    if (closed) return;
    const env: SseEnvelope<T> = {
      id: String(++seq),
      type,
      ts: nowMs(),
      data,
    };
    writeEvent(res, type, JSON.stringify(env));
  };

  return {
    send,
    heartbeat: () => {
      if (closed) return;
      res.write(`: ping ${nowMs()}\n\n`);
    },
    close,
  };
}

