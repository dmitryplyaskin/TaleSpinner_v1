import OpenAI from "openai";
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
} from "openai/resources";

import type {
  LlmGatewayProviderRequest,
  LlmGatewayResult,
  LlmGatewayStreamEvent,
  LlmProviderAdapter,
} from "../types";

function toChatMessages(
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (m.role === "system") return { role: "system", content: m.content };
    if (m.role === "user") return { role: "user", content: m.content };
    return { role: "assistant", content: m.content };
  });
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
  const { stream: _stream, ...rest } = req.payload as Record<string, unknown> & {
    stream?: unknown;
  };
  return {
    ...(rest as Record<string, unknown>),
    model: req.model,
    messages: toChatMessages(req.messages),
  } as ChatCompletionCreateParamsNonStreaming;
}

function buildStreamingPayload(
  req: LlmGatewayProviderRequest
): ChatCompletionCreateParamsStreaming {
  const { stream: _stream, ...rest } = req.payload as Record<string, unknown> & {
    stream?: unknown;
  };
  return {
    ...(rest as Record<string, unknown>),
    model: req.model,
    messages: toChatMessages(req.messages),
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

