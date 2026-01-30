import { createLlmGateway } from "./gateway";
import { anthropicCachePlugin } from "./plugins/anthropic-cache";
import { messageNormalizationPlugin } from "./plugins/message-normalization";
import { OpenAiCompatibleProvider } from "./providers/openai-compatible";
import { OpenRouterProvider } from "./providers/openrouter";

/**
 * Black-box LLM gateway singleton.
 *
 * Public surface:
 * - `llmGateway.generate(req)` for non-stream calls
 * - `llmGateway.stream(req)` for streaming calls
 *
 * Extension model:
 * - add providers/plugins inside this module (no external wiring)
 * - plugins can extend request `features` typing via declaration merging
 */
export const llmGateway = createLlmGateway({
  providers: [
    new OpenRouterProvider(),
    new OpenAiCompatibleProvider({
      id: "openai",
      defaultBaseUrl: "https://api.openai.com/v1",
    }),
    // Generic OpenAI-compatible provider (requires passing baseUrl in request).
    new OpenAiCompatibleProvider({ id: "openai_compatible" }),
  ],
  plugins: [messageNormalizationPlugin, anthropicCachePlugin],
});

export * from "./types";

