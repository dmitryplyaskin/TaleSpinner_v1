import OpenAI from "openai";

import type {
  LlmGatewayProviderRequest,
  LlmGatewayResult,
  LlmGatewayStreamEvent,
  LlmProviderAdapter,
} from "../types";
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from "openai/resources";

function toChatMessages(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "system") return { role: "system", content: m.content };
    if (m.role === "user") return { role: "user", content: m.content };
    return { role: "assistant", content: m.content };
  });
}

function resolvePayloadMessages(req: LlmGatewayProviderRequest): unknown[] {
  const payloadMessages = (req.payload as Record<string, unknown>)?.messages;
  if (Array.isArray(payloadMessages)) {
    return payloadMessages as unknown[];
  }
  return toChatMessages(req.messages);
}

function createClient(params: {
  token: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}): OpenAI {
  return new OpenAI({
    apiKey: params.token,
    baseURL: params.baseUrl,
    defaultHeaders: params.headers,
  });
}

function buildNonStreamingPayload(
  req: LlmGatewayProviderRequest
): ChatCompletionCreateParamsNonStreaming {
  const { stream: _stream, messages: _messages, ...rest } = req.payload as Record<string, unknown> & {
    stream?: unknown;
    messages?: unknown;
  };
  return {
    ...(rest as Record<string, unknown>),
    model: req.model,
    messages: resolvePayloadMessages(req),
  } as ChatCompletionCreateParamsNonStreaming;
}

function buildStreamingPayload(
  req: LlmGatewayProviderRequest
): ChatCompletionCreateParamsStreaming {
  const { stream: _stream, messages: _messages, ...rest } = req.payload as Record<string, unknown> & {
    stream?: unknown;
    messages?: unknown;
  };
  return {
    ...(rest as Record<string, unknown>),
    model: req.model,
    messages: resolvePayloadMessages(req),
    stream: true,
  } as ChatCompletionCreateParamsStreaming;
}

export class OpenAiCompatibleProvider implements LlmProviderAdapter {
  readonly id: string;
  private readonly defaultBaseUrl?: string;

  constructor(params: { id?: string; defaultBaseUrl?: string }) {
    this.id = params.id ?? "openai_compatible";
    this.defaultBaseUrl = params.defaultBaseUrl;
  }

  async generate(req: LlmGatewayProviderRequest): Promise<LlmGatewayResult> {
    const client = createClient({
      token: req.provider.token,
      baseUrl: req.provider.baseUrl ?? this.defaultBaseUrl,
      headers: req.headers,
    });

    const payload = buildNonStreamingPayload(req);

    try {
      const completion = await client.chat.completions.create(payload, {
        signal: req.abortSignal,
      });

      const text = completion.choices?.[0]?.message?.content ?? "";
      return { text, raw: completion, usage: completion.usage };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return { text: "", warnings: ["Request aborted"] };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { text: "", warnings: [`Provider error: ${msg}`], raw: err };
    }
  }

  async *stream(req: LlmGatewayProviderRequest): AsyncGenerator<LlmGatewayStreamEvent> {
    const client = createClient({
      token: req.provider.token,
      baseUrl: req.provider.baseUrl ?? this.defaultBaseUrl,
      headers: req.headers,
    });

    const payload = buildStreamingPayload(req);

    try {
      const response = await client.chat.completions.create(payload, {
        signal: req.abortSignal,
      });

      for await (const chunk of response as AsyncIterable<ChatCompletionChunk>) {
        if (req.abortSignal?.aborted) {
          yield { type: "done", status: "aborted", warnings: ["Request aborted"] };
          return;
        }
        const text = chunk.choices?.[0]?.delta?.content ?? "";
        if (typeof text === "string" && text.length > 0) {
          yield { type: "delta", text };
        }
        const reasoning = extractReasoningText(chunk);
        if (reasoning.length > 0) {
          yield { type: "reasoning_delta", text: reasoning };
        }
      }

      yield { type: "done", status: "done" };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        yield { type: "done", status: "aborted", warnings: ["Request aborted"] };
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      yield { type: "error", message: msg };
      yield { type: "done", status: "error", warnings: [`Provider error: ${msg}`] };
    }
  }
}

function extractReasoningText(chunk: ChatCompletionChunk): string {
  const delta: any = chunk?.choices?.[0]?.delta;
  if (!delta || typeof delta !== "object") return "";

  const out: string[] = [];
  const pushIfString = (value: unknown): void => {
    if (typeof value === "string" && value.length > 0) out.push(value);
  };

  pushIfString(delta.reasoning);
  pushIfString(delta.reasoning_content);

  const reasoningObj = delta.reasoning;
  if (reasoningObj && typeof reasoningObj === "object") {
    pushIfString((reasoningObj as any).text);
    const content = (reasoningObj as any).content;
    if (Array.isArray(content)) {
      for (const item of content) {
        if (!item || typeof item !== "object") continue;
        pushIfString((item as any).text);
      }
    }
  }

  if (Array.isArray(delta.content)) {
    for (const item of delta.content) {
      if (!item || typeof item !== "object") continue;
      const itemType = typeof (item as any).type === "string" ? (item as any).type : "";
      if (itemType.includes("reasoning")) {
        pushIfString((item as any).text);
      }
    }
  }

  return out.join("");
}

