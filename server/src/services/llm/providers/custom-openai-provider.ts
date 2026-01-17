import axios from "axios";
import OpenAI from "openai";

import {
  customOpenAiConfigSchema,
  parseProviderConfig,
  type CustomOpenAiConfig,
} from "../llm-definitions";

import type {
  LlmModelItem,
  LlmProvider,
  LlmProviderContext,
  LlmStreamChunk,
} from "./types";
import type { GenerateMessage } from "@shared/types/generate";
import type { ChatCompletionMessageParam } from "openai/resources";

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

function toChatMessages(messages: GenerateMessage[]): ChatCompletionMessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function createClient(token: string, baseUrl: string): OpenAI {
  return new OpenAI({
    apiKey: token,
    baseURL: baseUrl,
  });
}

export class CustomOpenAiProvider implements LlmProvider {
  readonly id = "custom_openai" as const;

  async getModels(ctx: LlmProviderContext): Promise<LlmModelItem[]> {
    const parsed = customOpenAiConfigSchema.parse(parseProviderConfig(ctx.providerId, ctx.config));
    const baseUrl = normalizeBaseUrl(parsed.baseUrl);

    const response = await axios.get(`${baseUrl}/models`, {
      headers: {
        Authorization: `Bearer ${ctx.token}`,
      },
    });

    const raw = (response.data?.data ?? []) as Array<{ id: string }>;
    return raw
      .filter((m) => typeof m?.id === "string" && m.id.length > 0)
      .map((m) => ({ id: m.id, name: m.id }));
  }

  async *streamChat(params: {
    ctx: LlmProviderContext;
    messages: GenerateMessage[];
    settings: Record<string, unknown>;
    abortController?: AbortController;
  }): AsyncGenerator<LlmStreamChunk> {
    const { ctx, messages, settings, abortController } = params;
    const config = parseProviderConfig(ctx.providerId, ctx.config) as CustomOpenAiConfig;
    const parsed = customOpenAiConfigSchema.parse(config);
    const baseUrl = normalizeBaseUrl(parsed.baseUrl);

    const model = ctx.model || parsed.defaultModel || "gpt-4o-mini";

    try {
      const client = createClient(ctx.token, baseUrl);
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

