import type { LlmProviderConfig, LlmProviderId, LlmRuntimeProviderState } from '@shared/types/llm';

export type ProviderConnectionDraft = {
	providerId: LlmProviderId;
	tokenId: string | null;
	modelId: string | null;
	config: LlmProviderConfig;
};

const DEFAULT_OPENROUTER_CONFIG: LlmProviderConfig = {
	openRouterRouting: { strategy: 'auto', allowFallbacks: true },
};

export function normalizeProviderConfig(providerId: LlmProviderId, config?: LlmProviderConfig): LlmProviderConfig {
	if (providerId === 'openai_compatible') return { baseUrl: '', ...(config ?? {}) };
	return {
		...DEFAULT_OPENROUTER_CONFIG,
		...(config ?? {}),
		openRouterRouting: config?.openRouterRouting ?? DEFAULT_OPENROUTER_CONFIG.openRouterRouting,
	};
}

export function createProviderDraft(
	providerId: LlmProviderId,
	config: LlmProviderConfig | undefined,
	state: Pick<LlmRuntimeProviderState, 'lastTokenId' | 'lastModel'>,
): ProviderConnectionDraft {
	return {
		providerId,
		tokenId: state.lastTokenId,
		modelId: state.lastModel,
		config: normalizeProviderConfig(providerId, config),
	};
}
