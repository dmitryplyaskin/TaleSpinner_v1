import { CustomOpenAiProvider } from "./providers/custom-openai-provider";
import { OpenRouterProvider } from "./providers/openrouter-provider";

import type { LlmProviderId } from "./llm-definitions";
import type { LlmProvider } from "./providers/types";

const providers: Record<LlmProviderId, LlmProvider> = {
  openrouter: new OpenRouterProvider(),
  custom_openai: new CustomOpenAiProvider(),
};

export function getProvider(providerId: LlmProviderId): LlmProvider {
  return providers[providerId];
}

