import axios from "axios";
import OpenAI from "openai";

import { parseProviderConfig, type OpenRouterConfig } from "../llm-definitions";

import type {
  LlmModelItem,
  LlmProvider,
  LlmProviderContext,
  LlmStreamChunk,
} from "./types";
import type { GenerateMessage } from "@shared/types/generate";
import type { ChatCompletionMessageParam } from "openai/resources";

function toChatMessages(messages: GenerateMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function createClient(token: string): OpenAI {
  return new OpenAI({
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: token,
    defaultHeaders: {
      "HTTP-Referer": "http://localhost:5000",
      "X-Title": "TaleSpinner",
    },
  });
}

export class OpenRouterProvider implements LlmProvider {
  readonly id = "openrouter" as const;

  async getModels(ctx: LlmProviderContext): Promise<LlmModelItem[]> {
    const token = ctx.token;
    const response = await axios.get("https://openrouter.ai/api/v1/models", {
      headers: {
        "HTTP-Referer": "http://localhost:5000",
        "X-Title": "TaleSpinner",
        Authorization: `Bearer ${token}`,
      },
    });

    const raw = (response.data?.data ?? []) as Array<{ id: string; name?: string }>;
    return raw
      .filter((m) => typeof m?.id === "string" && m.id.length > 0)
      .map((m) => ({ id: m.id, name: m.name ?? m.id }));
  }

  async *streamChat(params: {
    ctx: LlmProviderContext;
    messages: GenerateMessage[];
    settings: Record<string, unknown>;
    abortController?: AbortController;
  }): AsyncGenerator<LlmStreamChunk> {
    const { ctx, messages, settings, abortController } = params;
    const config = parseProviderConfig(ctx.providerId, ctx.config) as OpenRouterConfig;
    const model =
      ctx.model ||
      config.defaultModel ||
      "google/gemini-2.0-flash-lite-preview-02-05:free";

    try {
      const client = createClient(ctx.token);
      const response = await client.chat.completions.create(
        {
          model,
          messages: toChatMessages(messages),
          ...settings,
          stream: true,
        },
        { signal: abortController?.signal }
      );

      for await (const chunk of response) {
        if (abortController?.signal.aborted) {
          return;
        }
        const content = chunk.choices?.[0]?.delta?.content ?? "";
        if (content) {
          yield { content, error: null };
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      yield { content: "", error: message };
    }
  }
}

