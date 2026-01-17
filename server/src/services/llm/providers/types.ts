import type { LlmProviderId } from "../llm-definitions";
import type { GenerateMessage } from "@shared/types/generate";

export type LlmStreamChunk = { content: string; error: string | null };

export type LlmProviderContext = {
  providerId: LlmProviderId;
  token: string;
  model: string;
  config: unknown;
};

export type LlmModelItem = { id: string; name: string };

export interface LlmProvider {
  readonly id: LlmProviderId;
  getModels(ctx: LlmProviderContext): Promise<LlmModelItem[]>;
  streamChat(params: {
    ctx: LlmProviderContext;
    messages: GenerateMessage[];
    settings: Record<string, unknown>;
    abortController?: AbortController;
  }): AsyncGenerator<LlmStreamChunk>;
}

