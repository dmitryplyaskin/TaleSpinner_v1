import { createEffect } from 'effector';

import * as llmApi from '../../api/llm';

import { AsyncResourceCache } from './async-resource-cache';

import type {
	LlmModel,
	LlmOpenRouterEndpoint,
	LlmProviderConfig,
	LlmProviderDefinition,
	LlmProviderId,
	LlmRuntime,
	LlmRuntimeProviderState,
	LlmScope,
	LlmTokenListItem,
} from '@shared/types/llm';

type RuntimeParams = { scope: LlmScope; scopeId: string };
export type ModelsParams = RuntimeParams & { providerId: LlmProviderId; tokenId?: string | null };
type ProviderConfigResult = { providerId: LlmProviderId; config: LlmProviderConfig };
type TokensResult = { providerId: LlmProviderId; tokens: LlmTokenListItem[] };
type ModelsResult = { key: string; models: LlmModel[] };
type EndpointsResult = { modelId: string; endpoints: LlmOpenRouterEndpoint[] };

const providersCache = new AsyncResourceCache<'all', LlmProviderDefinition[]>();
const runtimeCache = new AsyncResourceCache<string, LlmRuntime>();
const runtimeProviderStateCache = new AsyncResourceCache<string, LlmRuntimeProviderState>();
const configCache = new AsyncResourceCache<LlmProviderId, ProviderConfigResult>();
const tokensCache = new AsyncResourceCache<LlmProviderId, TokensResult>();
const modelsCache = new AsyncResourceCache<string, ModelsResult>();
const endpointsCache = new AsyncResourceCache<string, EndpointsResult>();
const presetsCache = new AsyncResourceCache<'global', llmApi.LlmPresetDto[]>();
const presetSettingsCache = new AsyncResourceCache<'global', llmApi.LlmPresetSettingsDto>();

const runtimeKey = ({ scope, scopeId }: RuntimeParams) => `${scope}:${scopeId}`;
export const providerTokenKey = (providerId: LlmProviderId, tokenId?: string | null) =>
	`${providerId}:${tokenId ?? 'none'}`;

export const loadProvidersFx = createEffect(() => providersCache.load('all', llmApi.getProviders, true));
export const ensureProvidersFx = createEffect(() => providersCache.load('all', llmApi.getProviders));

const runtimeProviderStateKey = (params: RuntimeParams & { providerId: LlmProviderId }) =>
	`${runtimeKey(params)}:${params.providerId}`;
const fetchRuntime = async (params: RuntimeParams) => {
	const runtime = await llmApi.getRuntime(params);
	cacheRuntime(runtime);
	return runtime;
};
export const loadRuntimeFx = createEffect((params: RuntimeParams) =>
	runtimeCache.load(runtimeKey(params), () => fetchRuntime(params), true),
);
export const ensureRuntimeFx = createEffect((params: RuntimeParams) =>
	runtimeCache.load(runtimeKey(params), () => fetchRuntime(params)),
);

const fetchRuntimeProviderState = (params: RuntimeParams & { providerId: LlmProviderId }) =>
	llmApi.getRuntimeProviderState(params);
export const loadRuntimeProviderStateFx = createEffect((params: RuntimeParams & { providerId: LlmProviderId }) =>
	runtimeProviderStateCache.load(runtimeProviderStateKey(params), () => fetchRuntimeProviderState(params), true),
);
export const ensureRuntimeProviderStateFx = createEffect((params: RuntimeParams & { providerId: LlmProviderId }) =>
	runtimeProviderStateCache.load(runtimeProviderStateKey(params), () => fetchRuntimeProviderState(params)),
);

const fetchConfig = (providerId: LlmProviderId) => llmApi.getProviderConfig(providerId);
export const loadProviderConfigFx = createEffect((providerId: LlmProviderId) =>
	configCache.load(providerId, () => fetchConfig(providerId), true),
);
export const ensureProviderConfigFx = createEffect((providerId: LlmProviderId) =>
	configCache.load(providerId, () => fetchConfig(providerId)),
);

const fetchTokens = async (providerId: LlmProviderId): Promise<TokensResult> => ({
	providerId,
	tokens: await llmApi.listTokens(providerId),
});
export const loadTokensFx = createEffect((providerId: LlmProviderId) =>
	tokensCache.load(providerId, () => fetchTokens(providerId), true),
);
export const ensureTokensFx = createEffect((providerId: LlmProviderId) =>
	tokensCache.load(providerId, () => fetchTokens(providerId)),
);

const fetchModels = async (params: ModelsParams): Promise<ModelsResult> => ({
	key: providerTokenKey(params.providerId, params.tokenId),
	models: await llmApi.getModels(params),
});
export const loadModelsFx = createEffect((params: ModelsParams) => {
	const key = providerTokenKey(params.providerId, params.tokenId);
	return modelsCache.load(key, () => fetchModels(params), true);
});
export const ensureModelsFx = createEffect((params: ModelsParams) => {
	const key = providerTokenKey(params.providerId, params.tokenId);
	return modelsCache.load(key, () => fetchModels(params));
});

const fetchEndpoints = async (modelId: string): Promise<EndpointsResult> => ({
	modelId,
	endpoints: await llmApi.getOpenRouterModelEndpoints(modelId),
});
export const loadOpenRouterEndpointsFx = createEffect((modelId: string) =>
	endpointsCache.load(modelId, () => fetchEndpoints(modelId), true),
);
export const ensureOpenRouterEndpointsFx = createEffect((modelId: string) =>
	endpointsCache.load(modelId, () => fetchEndpoints(modelId)),
);

export const loadLlmPresetsFx = createEffect(() =>
	presetsCache.load('global', () => llmApi.listLlmPresets('global'), true),
);
export const ensureLlmPresetsFx = createEffect(() =>
	presetsCache.load('global', () => llmApi.listLlmPresets('global')),
);
export const loadLlmPresetSettingsFx = createEffect(() =>
	presetSettingsCache.load('global', () => llmApi.getLlmPresetSettings('global'), true),
);
export const ensureLlmPresetSettingsFx = createEffect(() =>
	presetSettingsCache.load('global', () => llmApi.getLlmPresetSettings('global')),
);

export function cacheRuntime(runtime: LlmRuntime): void {
	runtimeCache.set(runtimeKey(runtime), runtime);
	runtimeProviderStateCache.set(runtimeProviderStateKey({ ...runtime, providerId: runtime.activeProviderId }), {
		scope: runtime.scope,
		scopeId: runtime.scopeId,
		providerId: runtime.activeProviderId,
		lastTokenId: runtime.activeTokenId,
		lastModel: runtime.activeModel,
	});
}

export function cacheProviderConfig(result: ProviderConfigResult): void {
	configCache.set(result.providerId, result);
}

export function cachePreset(preset: llmApi.LlmPresetDto): void {
	const current = presetsCache.peek('global');
	if (!current) return;
	presetsCache.set(
		'global',
		current.map((item) => (item.presetId === preset.presetId ? preset : item)),
	);
}

export function cachePresetSettings(settings: llmApi.LlmPresetSettingsDto): void {
	presetSettingsCache.set('global', settings);
}
