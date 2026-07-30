import { type Request, type Response } from "express";

import { initSse, type SseWriter } from "@core/sse/sse";

import { GenerationControlService } from "../services/chat-core/generation-control-service";

import type { ChatGenerationSession } from "../application/chat-runtime/contracts";
import type { RunEvent } from "../services/chat-generation-v3/contracts";

function mapRunStatusToStreamDoneStatus(
  status: "done" | "failed" | "aborted" | "error"
): "done" | "aborted" | "error" {
  if (status === "done") return "done";
  if (status === "aborted") return "aborted";
  return "error";
}

export async function proxyRunEventsToSse(params: {
  sse: SseWriter;
  events: AsyncGenerator<RunEvent>;
  envBase: Record<string, unknown>;
  reqClosed: () => boolean;
  abortController: AbortController;
  onGenerationId: (generationId: string) => void;
}): Promise<void> {
  let generationId: string | null = null;

  for await (const evt of params.events) {
    if (evt.type === "run.started") {
      generationId = evt.data.generationId;
      params.onGenerationId(generationId);
      if (params.reqClosed()) {
        params.abortController.abort();
        void GenerationControlService.requestAbort(generationId);
      }
      params.sse.send("llm.stream.meta", { ...params.envBase, generationId });
    }

    const eventEnvelope = {
      ...params.envBase,
      generationId,
      runId: evt.runId,
      seq: evt.seq,
      ...evt.data,
    };
    params.sse.send(evt.type, eventEnvelope);

    if (evt.type === "run.preparation_failed") {
      params.sse.send("llm.stream.error", {
        ...params.envBase,
        generationId: null,
        code: evt.data.code,
        message: evt.data.message,
      });
      params.sse.send("llm.stream.done", {
        ...params.envBase,
        generationId: null,
        status: "error",
      });
      break;
    }

    if (evt.type === "main_llm.delta" || evt.type === "main_llm.reasoning_delta") {
      const streamType =
        evt.type === "main_llm.delta" ? "llm.stream.delta" : "llm.stream.reasoning_delta";
      params.sse.send(streamType, {
        ...params.envBase,
        generationId,
        content: evt.data.content,
      });
      continue;
    }

    if (evt.type === "main_llm.finished" && evt.data.status === "error") {
      params.sse.send("llm.stream.error", {
        ...params.envBase,
        generationId,
        code: "generation_error",
        message: evt.data.message ?? "generation_error",
      });
      continue;
    }

    if (evt.type === "run.finished") {
      params.sse.send("llm.stream.done", {
        ...params.envBase,
        generationId,
        status: mapRunStatusToStreamDoneStatus(evt.data.status),
      });
      if (evt.data.status !== "done" && evt.data.message) {
        params.sse.send("llm.stream.error", {
          ...params.envBase,
          generationId,
          code: "generation_error",
          message: evt.data.message,
        });
      }
      break;
    }
  }
}

export async function streamGenerationSession(params: {
  req: Request;
  res: Response;
  buildSession: (abortController: AbortController) => Promise<ChatGenerationSession>;
}): Promise<void> {
  const sse = initSse({ res: params.res });
  let generationId: string | null = null;
  const runAbortController = new AbortController();
  let shouldAbortOnClose = false;
  let reqClosed = false;

  params.res.on("close", () => {
    reqClosed = true;
    if (shouldAbortOnClose) {
      runAbortController.abort();
      if (generationId) void GenerationControlService.requestAbort(generationId);
    }
    sse.close();
  });

  try {
    const session = await params.buildSession(runAbortController);
    shouldAbortOnClose = true;
    if (reqClosed) {
      runAbortController.abort();
      if (generationId) void GenerationControlService.requestAbort(generationId);
    }

    await proxyRunEventsToSse({
      sse,
      envBase: session.envBase,
      reqClosed: () => reqClosed,
      abortController: runAbortController,
      onGenerationId: (id) => {
        generationId = id;
      },
      events: session.events,
    });
  } finally {
    sse.close();
  }
}
