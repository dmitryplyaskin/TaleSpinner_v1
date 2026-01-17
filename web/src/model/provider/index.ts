import { createEffect, createEvent, createStore, sample } from 'effector';

import * as llmApi from '../../api/llm';

import type {
	LlmModel,
	LlmProviderConfig,
	LlmProviderDefinition,
	LlmProviderId,
	LlmRuntime,
	LlmScope,
	LlmTokenListItem,
} from '@shared/types/llm';

export type ScopeKey = `${LlmScope}:${string}`;

const toScopeKey = (scope: LlmScope, scopeId: string): ScopeKey => `${scope}:${scopeId}`;

export const loadProvidersFx = createEffect(async (): Promise<LlmProviderDefinition[]> => {
	return llmApi.getProviders();
});

export const loadRuntimeFx = createEffect(async (params: { scope: LlmScope; scopeId: string }): Promise<LlmRuntime> => {
	return llmApi.getRuntime(params);
});

export const patchRuntimeFx = createEffect(
	async (params: {
		scope: LlmScope;
		scopeId: string;
		activeProviderId: LlmProviderId;
		activeTokenId?: string | null;
		activeModel?: string | null;
	}): Promise<LlmRuntime> => {
		return llmApi.patchRuntime(params);
	},
);

export const loadProviderConfigFx = createEffect(
	async (providerId: LlmProviderId): Promise<{ providerId: LlmProviderId; config: LlmProviderConfig }> => {
		return llmApi.getProviderConfig(providerId);
	},
);

export const patchProviderConfigFx = createEffect(
	async (params: {
		providerId: LlmProviderId;
		config: LlmProviderConfig;
	}): Promise<{ providerId: LlmProviderId; config: LlmProviderConfig }> => {
		return llmApi.patchProviderConfig(params.providerId, params.config);
	},
);

export const loadTokensFx = createEffect(
	async (providerId: LlmProviderId): Promise<{ providerId: LlmProviderId; tokens: LlmTokenListItem[] }> => {
		const tokens = await llmApi.listTokens(providerId);
		return { providerId, tokens };
	},
);

export const createTokenFx = createEffect(
	async (params: { providerId: LlmProviderId; name: string; token: string }): Promise<LlmTokenListItem> => {
		return llmApi.createToken(params);
	},
);

export const patchTokenFx = createEffect(
	async (params: { id: string; name?: string; token?: string }): Promise<void> => {
		return llmApi.patchToken(params);
	},
);

export const deleteTokenFx = createEffect(async (id: string): Promise<void> => {
	return llmApi.deleteToken(id);
});

export const loadModelsFx = createEffect(
	async (params: {
		providerId: LlmProviderId;
		scope: LlmScope;
		scopeId: string;
		tokenId?: string | null;
	}): Promise<{ key: string; models: LlmModel[] }> => {
		const models = await llmApi.getModels(params);
		const tokenKey = params.tokenId ?? 'none';
		return { key: `${params.providerId}:${tokenKey}`, models };
	},
);

export const providerPickerMounted = createEvent<{ scope: LlmScope; scopeId: string }>();
export const providerSelected = createEvent<{ scope: LlmScope; scopeId: string; providerId: LlmProviderId }>();
export const tokenSelected = createEvent<{ scope: LlmScope; scopeId: string; tokenId: string | null }>();
export const modelSelected = createEvent<{ scope: LlmScope; scopeId: string; model: string | null }>();
export const tokenManagerOpened = createEvent<boolean>();

export const $providers = createStore<LlmProviderDefinition[]>([]);
export const $runtimeByScopeKey = createStore<Record<ScopeKey, LlmRuntime>>({} as Record<ScopeKey, LlmRuntime>);
export const $providerConfigById = createStore<Record<LlmProviderId, LlmProviderConfig>>(
	{} as Record<LlmProviderId, LlmProviderConfig>,
);
export const $tokensByProviderId = createStore<Record<LlmProviderId, LlmTokenListItem[]>>(
	{} as Record<LlmProviderId, LlmTokenListItem[]>,
);
export const $modelsByProviderTokenKey = createStore<Record<string, LlmModel[]>>({});
export const $isTokenManagerOpen = createStore(false);

$providers.on(loadProvidersFx.doneData, (_, providers) => providers);

$runtimeByScopeKey.on(loadRuntimeFx.doneData, (state, runtime) => ({
	...state,
	[toScopeKey(runtime.scope, runtime.scopeId)]: runtime,
}));
$runtimeByScopeKey.on(patchRuntimeFx.doneData, (state, runtime) => ({
	...state,
	[toScopeKey(runtime.scope, runtime.scopeId)]: runtime,
}));

$providerConfigById.on(loadProviderConfigFx.doneData, (state, payload) => ({
	...state,
	[payload.providerId]: payload.config,
}));
$providerConfigById.on(patchProviderConfigFx.doneData, (state, payload) => ({
	...state,
	[payload.providerId]: payload.config,
}));

$tokensByProviderId.on(loadTokensFx.doneData, (state, payload) => ({
	...state,
	[payload.providerId]: payload.tokens,
}));

$modelsByProviderTokenKey.on(loadModelsFx.doneData, (state, payload) => ({
	...state,
	[payload.key]: payload.models,
}));

$isTokenManagerOpen.on(tokenManagerOpened, (_, isOpen) => isOpen);

sample({
	clock: providerPickerMounted,
	target: loadProvidersFx,
});

sample({
	clock: providerPickerMounted,
	fn: ({ scope, scopeId }) => ({ scope, scopeId }),
	target: loadRuntimeFx,
});

sample({
	clock: loadRuntimeFx.doneData,
	fn: (runtime) => runtime.activeProviderId,
	target: [loadTokensFx, loadProviderConfigFx],
});

sample({
	clock: providerSelected,
	fn: ({ scope, scopeId, providerId }) => ({
		scope,
		scopeId,
		activeProviderId: providerId,
	}),
	target: patchRuntimeFx,
});

sample({
	clock: providerSelected,
	fn: ({ providerId }) => providerId,
	target: [loadTokensFx, loadProviderConfigFx],
});

sample({
	clock: tokenSelected,
	source: $runtimeByScopeKey,
	fn: (runtimeByKey, { scope, scopeId, tokenId }) => {
		const current = runtimeByKey[toScopeKey(scope, scopeId)];
		return {
			scope,
			scopeId,
			activeProviderId: current?.activeProviderId ?? 'openrouter',
			activeTokenId: tokenId,
			activeModel: current?.activeModel ?? null,
		};
	},
	target: patchRuntimeFx,
});

sample({
	clock: modelSelected,
	source: $runtimeByScopeKey,
	fn: (runtimeByKey, { scope, scopeId, model }) => {
		const current = runtimeByKey[toScopeKey(scope, scopeId)];
		return {
			scope,
			scopeId,
			activeProviderId: current?.activeProviderId ?? 'openrouter',
			activeTokenId: current?.activeTokenId ?? null,
			activeModel: model,
		};
	},
	target: patchRuntimeFx,
});

sample({
	clock: patchRuntimeFx.doneData,
	filter: (runtime) => Boolean(runtime.activeTokenId),
	fn: (runtime) => ({
		providerId: runtime.activeProviderId,
		scope: runtime.scope,
		scopeId: runtime.scopeId,
		tokenId: runtime.activeTokenId,
	}),
	target: loadModelsFx,
});

sample({
	clock: createTokenFx.doneData,
	fn: (token) => token.providerId,
	target: loadTokensFx,
});

sample({
	clock: patchTokenFx.done,
	source: $runtimeByScopeKey,
	fn: (runtimeByKey) => {
		const global = runtimeByKey[toScopeKey('global', 'global')];
		return global?.activeProviderId ?? 'openrouter';
	},
	target: loadTokensFx,
});

sample({
	clock: deleteTokenFx.done,
	source: $runtimeByScopeKey,
	fn: (runtimeByKey) => {
		const global = runtimeByKey[toScopeKey('global', 'global')];
		return global?.activeProviderId ?? 'openrouter';
	},
	target: loadTokensFx,
});

export const llmProviderModel = {
	$providers,
	$runtimeByScopeKey,
	$providerConfigById,
	$tokensByProviderId,
	$modelsByProviderTokenKey,
	$isTokenManagerOpen,

	providerPickerMounted,
	providerSelected,
	tokenSelected,
	modelSelected,
	tokenManagerOpened,

	loadProvidersFx,
	loadRuntimeFx,
	patchRuntimeFx,
	loadTokensFx,
	createTokenFx,
	patchTokenFx,
	deleteTokenFx,
	loadModelsFx,
	loadProviderConfigFx,
	patchProviderConfigFx,
};
