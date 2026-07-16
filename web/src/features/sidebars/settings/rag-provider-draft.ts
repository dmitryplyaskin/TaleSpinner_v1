import type { RagProviderConfig, RagProviderId, RagRuntime } from '@shared/types/rag';

export type RagProviderDraft = {
	providerId: RagProviderId;
	tokenId: string | null;
	modelId: string | null;
	config: RagProviderConfig;
};

const DEFAULT_CONFIGS: Record<RagProviderId, RagProviderConfig> = {
	openrouter: { defaultModel: 'text-embedding-3-small', encodingFormat: 'float' },
	ollama: {
		baseUrl: 'http://localhost:11434',
		defaultModel: 'nomic-embed-text',
		keepAlive: '5m',
		truncate: true,
	},
};

export function normalizeRagProviderConfig(
	providerId: RagProviderId,
	config?: RagProviderConfig,
): RagProviderConfig {
	return { ...DEFAULT_CONFIGS[providerId], ...(config ?? {}) };
}

export function createRagProviderDraft(
	providerId: RagProviderId,
	config?: RagProviderConfig,
	runtime?: RagRuntime | null,
): RagProviderDraft {
	const normalizedConfig = normalizeRagProviderConfig(providerId, config);
	const usesRuntime = runtime?.activeProviderId === providerId;
	return {
		providerId,
		tokenId: providerId === 'openrouter' && usesRuntime ? (runtime.activeTokenId ?? null) : null,
		modelId:
			(usesRuntime ? runtime.activeModel : null) ??
			(typeof normalizedConfig.defaultModel === 'string' ? normalizedConfig.defaultModel : null),
		config: normalizedConfig,
	};
}
