import { describe, expect, test, vi } from "vitest";

import { proxyRunEventsToSse } from "./chat-generation-stream";

import type { RunEvent } from "../services/chat-generation-v3/contracts";
import type { SseWriter } from "@core/sse/sse";

describe("proxyRunEventsToSse", () => {
  test("preserves the normal generation stream compatibility events", async () => {
    const sent: Array<{ type: string; data: unknown }> = [];
    const sse: SseWriter = {
      send: (type, data) => sent.push({ type, data }),
      heartbeat: vi.fn(),
      close: vi.fn(),
    };
    const events = (async function* (): AsyncGenerator<RunEvent> {
      yield {
        runId: "generation-1",
        seq: 1,
        type: "run.started",
        data: { generationId: "generation-1", trigger: "generate" },
      };
      yield {
        runId: "generation-1",
        seq: 2,
        type: "main_llm.delta",
        data: { content: "hello" },
      };
      yield {
        runId: "generation-1",
        seq: 3,
        type: "run.finished",
        data: { generationId: "generation-1", status: "done", failedType: null },
      };
    })();
    const onGenerationId = vi.fn();

    await proxyRunEventsToSse({
      sse,
      events,
      envBase: { chatId: "chat-1" },
      reqClosed: () => false,
      abortController: new AbortController(),
      onGenerationId,
    });

    expect(onGenerationId).toHaveBeenCalledWith("generation-1");
    expect(sent.map((event) => event.type)).toEqual([
      "llm.stream.meta",
      "run.started",
      "main_llm.delta",
      "llm.stream.delta",
      "run.finished",
      "llm.stream.done",
    ]);
    expect(sent[sent.length - 1]?.data).toMatchObject({
      generationId: "generation-1",
      status: "done",
    });
  });

  test("maps preparation failure to terminal SSE error events", async () => {
    const sent: Array<{ type: string; data: unknown }> = [];
    const sse: SseWriter = {
      send: (type, data) => sent.push({ type, data }),
      heartbeat: vi.fn(),
      close: vi.fn(),
    };
    const events = (async function* (): AsyncGenerator<RunEvent> {
      yield {
        runId: "request-1",
        seq: 1,
        type: "run.preparation_failed",
        data: {
          generationId: null,
          status: "error",
          code: "generation_preparation_error",
          message: "profile compilation failed",
        },
      };
    })();

    await proxyRunEventsToSse({
      sse,
      events,
      envBase: { chatId: "chat-1" },
      reqClosed: () => false,
      abortController: new AbortController(),
      onGenerationId: vi.fn(),
    });

    expect(sent).toEqual([
      expect.objectContaining({ type: "run.preparation_failed" }),
      {
        type: "llm.stream.error",
        data: {
          chatId: "chat-1",
          generationId: null,
          code: "generation_preparation_error",
          message: "profile compilation failed",
        },
      },
      {
        type: "llm.stream.done",
        data: {
          chatId: "chat-1",
          generationId: null,
          status: "error",
        },
      },
    ]);
  });
});
