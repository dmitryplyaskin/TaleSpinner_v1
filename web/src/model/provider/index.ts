import { createEvent, createStore, sample } from 'effector';

import {
	applyLlmPresetFx,
	checkProviderConnectionFx,
	createLlmPresetFx,
	createTokenFx,
	deleteLlmPresetFx,
	deleteTokenFx,
	patchLlmPresetSettingsFx,
	patchTokenFx,
	saveConnectionFx,
	updateLlmPresetFx,
} from './action-effects';
import {
	ensureLlmPresetSettingsFx,
	ensureLlmPresetsFx,
	ensureModelsFx,
	ensureOpenRouterEndpointsFx,
	ensureProviderConfigFx,
	ensureProvidersFx,
	ensureRuntimeFx,
	ensureRuntimeProviderStateFx,
	ensureTokensFx,
	loadLlmPresetSettingsFx,
	loadLlmPresetsFx,
	loadModelsFx,
	loadOpenRouterEndpointsFx,
	loadProviderConfigFx,
	loadProvidersFx,
	loadRuntimeFx,
	loadRuntimeProviderStateFx,
	loadTokensFx,
} from './resource-effects';

import type { LlmPresetDto, LlmPresetSettingsDto } from '../../api/llm';
import type {
	LlmModel,
	LlmOpenRouterEndpoint,
	LlmProviderConfig,
	LlmProviderDefinition,
	LlmProviderId,
	LlmRuntime,
	LlmScope,
	LlmTokenListItem,
} from '@shared/types/llm';

export type ScopeKey = `${LlmScope}:${string}`;

const toScopeKey = (scope: LlmScope, scopeId: string): ScopeKey => `${scope}:${scopeId}`;

export const providerPickerMounted = createEvent<{ scope: LlmScope; scopeId: string }>();

export const $providers = createStore<LlmProviderDefinition[]>([]);
export const $runtimeByScopeKey = createStore<Record<ScopeKey, LlmRuntime>>({} as Record<ScopeKey, LlmRuntime>);
export const $providerConfigById = createStore<Record<LlmProviderId, LlmProviderConfig>>(
	{} as Record<LlmProviderId, LlmProviderConfig>,
);
export const $tokensByProviderId = createStore<Record<LlmProviderId, LlmTokenListItem[]>>(
	{} as Record<LlmProviderId, LlmTokenListItem[]>,
);
export const $modelsByProviderTokenKey = createStore<Record<string, LlmModel[]>>({});
export const $openRouterEndpointsByModel = createStore<Record<string, LlmOpenRouterEndpoint[]>>({});
export const $llmPresets = createStore<LlmPresetDto[]>([]);
export const $llmPresetSettings = createStore<LlmPresetSettingsDto | null>(null);

$providers.on([loadProvidersFx.doneData, ensureProvidersFx.doneData], (_, providers) => providers);

$runtimeByScopeKey.on([loadRuntimeFx.doneData, ensureRuntimeFx.doneData], (state, runtime) => ({
	...state,
	[toScopeKey(runtime.scope, runtime.scopeId)]: runtime,
}));
$providerConfigById.on([loadProviderConfigFx.doneData, ensureProviderConfigFx.doneData], (state, payload) => ({
	...state,
	[payload.providerId]: payload.config,
}));

$tokensByProviderId.on([loadTokensFx.doneData, ensureTokensFx.doneData], (state, payload) => ({
	...state,
	[payload.providerId]: payload.tokens,
}));

$modelsByProviderTokenKey.on([loadModelsFx.doneData, ensureModelsFx.doneData], (state, payload) => ({
	...state,
	[payload.key]: payload.models,
}));

$llmPresets.on([loadLlmPresetsFx.doneData, ensureLlmPresetsFx.doneData], (_, presets) => presets);
$llmPresetSettings
	.on([loadLlmPresetSettingsFx.doneData, ensureLlmPresetSettingsFx.doneData], (_, settings) => settings)
	.on(patchLlmPresetSettingsFx.doneData, (_, settings) => settings);
$runtimeByScopeKey.on(applyLlmPresetFx.doneData, (state, payload) => ({
	...state,
	[toScopeKey(payload.runtime.scope, payload.runtime.scopeId)]: payload.runtime,
}));

$openRouterEndpointsByModel.on(
	[loadOpenRouterEndpointsFx.doneData, ensureOpenRouterEndpointsFx.doneData],
	(state, payload) => ({
	...state,
	[payload.modelId]: payload.endpoints,
}),
);

$providerConfigById.on(saveConnectionFx.doneData, (state, payload) => ({
	...state,
	[payload.config.providerId]: payload.config.config,
}));
$runtimeByScopeKey.on(saveConnectionFx.doneData, (state, payload) => ({
	...state,
	[toScopeKey(payload.runtime.scope, payload.runtime.scopeId)]: payload.runtime,
}));
$llmPresets.on(saveConnectionFx.doneData, (state, payload) =>
	payload.preset ? state.map((item) => (item.presetId === payload.preset?.presetId ? payload.preset : item)) : state,
);

sample({
	clock: providerPickerMounted,
	target: ensureProvidersFx,
});

sample({
	clock: providerPickerMounted,
	target: [ensureLlmPresetsFx, ensureLlmPresetSettingsFx],
});

sample({
	clock: providerPickerMounted,
	fn: ({ scope, scopeId }) => ({ scope, scopeId }),
	target: ensureRuntimeFx,
});

sample({
	clock: [loadRuntimeFx.doneData, ensureRuntimeFx.doneData],
	fn: (runtime) => runtime.activeProviderId,
	target: [ensureTokensFx, ensureProviderConfigFx],
});

sample({
	clock: [loadRuntimeFx.doneData, ensureRuntimeFx.doneData],
	filter: (runtime) => Boolean(runtime.activeTokenId),
	fn: (runtime) => ({
		providerId: runtime.activeProviderId,
		scope: runtime.scope,
		scopeId: runtime.scopeId,
		tokenId: runtime.activeTokenId,
	}),
	target: ensureModelsFx,
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

sample({
	clock: [createLlmPresetFx.doneData, updateLlmPresetFx.doneData, deleteLlmPresetFx.done, applyLlmPresetFx.doneData],
	fn: () => undefined,
	target: [loadLlmPresetsFx, loadLlmPresetSettingsFx],
});

sample({
	clock: applyLlmPresetFx.doneData,
	fn: (payload) => payload.runtime.activeProviderId,
	target: ensureTokensFx,
});

sample({
	clock: applyLlmPresetFx.doneData,
	fn: (payload) => payload.runtime.activeProviderId,
	target: loadProviderConfigFx,
});

export const llmProviderModel = {
	$providers,
	$runtimeByScopeKey,
	$providerConfigById,
	$tokensByProviderId,
	$modelsByProviderTokenKey,
	$openRouterEndpointsByModel,
	$llmPresets,
	$llmPresetSettings,

	providerPickerMounted,

	loadProvidersFx,
	ensureProvidersFx,
	loadRuntimeFx,
	ensureRuntimeFx,
	loadRuntimeProviderStateFx,
	ensureRuntimeProviderStateFx,
	loadTokensFx,
	ensureTokensFx,
	createTokenFx,
	patchTokenFx,
	deleteTokenFx,
	loadModelsFx,
	ensureModelsFx,
	loadOpenRouterEndpointsFx,
	ensureOpenRouterEndpointsFx,
	saveConnectionFx,
	loadProviderConfigFx,
	ensureProviderConfigFx,
	checkProviderConnectionFx,
	loadLlmPresetsFx,
	ensureLlmPresetsFx,
	loadLlmPresetSettingsFx,
	ensureLlmPresetSettingsFx,
	createLlmPresetFx,
	updateLlmPresetFx,
	deleteLlmPresetFx,
	applyLlmPresetFx,
	patchLlmPresetSettingsFx,
};
