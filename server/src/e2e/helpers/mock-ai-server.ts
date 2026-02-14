import { once } from "node:events";
import { type AddressInfo } from "node:net";

import express, { type Request, type Response } from "express";
import { type Server } from "node:http";

export type RunningMockAiServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

type Scenario =
  | "success_text_stream"
  | "success_text_plus_reasoning"
  | "empty_done"
  | "provider_http_error"
  | "partial_then_error"
  | "slow_stream"
  | "malformed_stream_chunk"
  | "fallback_token_first_fails_second_succeeds";

function getToken(req: Request): string {
  const raw = String(req.headers.authorization ?? "");
  return raw.replace(/^Bearer\s+/i, "").trim();
}

function resolveScenario(req: Request): Scenario {
  const model = String(req.body?.model ?? "");
  if (
    model === "success_text_stream" ||
    model === "success_text_plus_reasoning" ||
    model === "empty_done" ||
    model === "provider_http_error" ||
    model === "partial_then_error" ||
    model === "slow_stream" ||
    model === "malformed_stream_chunk" ||
    model === "fallback_token_first_fails_second_succeeds"
  ) {
    return model;
  }
  return "success_text_stream";
}

function writeChunk(res: Response, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function writeDone(res: Response): void {
  res.write("data: [DONE]\n\n");
}

function makeChunk(params: {
  model: string;
  content?: string;
  reasoning?: string;
  finishReason?: "stop" | null;
}): Record<string, unknown> {
  const delta: Record<string, unknown> = {};
  if (params.content) delta.content = params.content;
  if (params.reasoning) delta.reasoning = params.reasoning;

  return {
    id: "chatcmpl-mock",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: params.model,
    choices: [
      {
        index: 0,
        delta,
        finish_reason: typeof params.finishReason === "undefined" ? null : params.finishReason,
      },
    ],
  };
}

async function wait(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function streamScenario(req: Request, res: Response): Promise<void> {
  const scenario = resolveScenario(req);
  const model = String(req.body?.model ?? "mock-model");
  const token = getToken(req);

  if (scenario === "fallback_token_first_fails_second_succeeds" && token === "tok_fail") {
    res.status(500).json({
      error: { message: "first token failed" },
    });
    return;
  }

  if (scenario === "provider_http_error") {
    res.status(500).json({
      error: { message: "provider_http_error" },
    });
    return;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  if (scenario === "empty_done") {
    writeChunk(res, makeChunk({ model, finishReason: "stop" }));
    writeDone(res);
    res.end();
    return;
  }

  if (scenario === "malformed_stream_chunk") {
    res.write("data: {\"id\":\"broken\"\n\n");
    writeDone(res);
    res.end();
    return;
  }

  if (scenario === "partial_then_error") {
    writeChunk(res, makeChunk({ model, content: "partial " }));
    await wait(10);
    res.destroy(new Error("partial_then_error"));
    return;
  }

  if (scenario === "slow_stream") {
    writeChunk(res, makeChunk({ model, content: "slow " }));
    await wait(250);
    writeChunk(res, makeChunk({ model, content: "response" }));
    writeChunk(res, makeChunk({ model, finishReason: "stop" }));
    writeDone(res);
    res.end();
    return;
  }

  if (scenario === "success_text_plus_reasoning") {
    writeChunk(res, makeChunk({ model, reasoning: "step-1 " }));
    writeChunk(res, makeChunk({ model, content: "answer " }));
    writeChunk(res, makeChunk({ model, reasoning: "step-2" }));
    writeChunk(res, makeChunk({ model, content: "done" }));
    writeChunk(res, makeChunk({ model, finishReason: "stop" }));
    writeDone(res);
    res.end();
    return;
  }

  writeChunk(res, makeChunk({ model, content: "hello " }));
  writeChunk(res, makeChunk({ model, content: "world" }));
  writeChunk(res, makeChunk({ model, finishReason: "stop" }));
  writeDone(res);
  res.end();
}

export async function startMockAiServer(): Promise<RunningMockAiServer> {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  app.get("/v1/models", (_req, res) => {
    res.status(200).json({
      data: [
        { id: "success_text_stream", name: "Success stream" },
        { id: "success_text_plus_reasoning", name: "Success + reasoning" },
        { id: "slow_stream", name: "Slow stream" },
      ],
    });
  });

  app.post("/v1/chat/completions", async (req, res) => {
    if (req.body?.stream === true) {
      await streamScenario(req, res);
      return;
    }

    const scenario = resolveScenario(req);
    if (scenario === "provider_http_error") {
      res.status(500).json({ error: { message: "provider_http_error" } });
      return;
    }
    res.status(200).json({
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: String(req.body?.model ?? "mock-model"),
      choices: [{ index: 0, message: { role: "assistant", content: "hello world" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
  });

  app.post("/api/embed", (req, res) => {
    const input = req.body?.input;
    const values = Array.isArray(input) ? input : [input];
    res.status(200).json({
      model: String(req.body?.model ?? "embed-model"),
      embeddings: values.map((_, index) => [index + 0.1, index + 0.2, index + 0.3]),
    });
  });

  const server: Server = app.listen(0);
  await once(server, "listening");
  const addr = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}
