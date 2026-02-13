import { createEffect, createEvent, createStore, sample } from 'effector';
import { debounce } from 'patronum/debounce';
import { v4 as uuidv4 } from 'uuid';

import * as ragApi from '../../api/rag';

import type { LlmTokenListItem } from '@shared/types/llm';
import type {
	RagModel,
	RagPreset,
	RagPresetSettings,
	RagProviderConfig,
	RagProviderDefinition,
	RagProviderId,
	RagRuntime,
} from '@shared/types/rag';

const toProviderTokenKey = (providerId: RagProviderId, tokenId: string | null): string => `${providerId}:${tokenId ?? 'none'}`;

const toPresetPayload = (
	runtime: RagRuntime,
	configs: Record<RagProviderId, RagProviderConfig>,
): RagPreset['payload'] => ({
	activeProviderId: runtime.activeProviderId,
	activeTokenId: runtime.activeTokenId ?? null,
	activeModel: runtime.activeModel ?? null,
	providerConfigsById: {
		openrouter: configs.openrouter ?? {},
		ollama: configs.ollama ?? {},
	},
});

const normalizePayload = (payload: RagPreset['payload']): RagPreset['payload'] => ({
	activeProviderId: payload.activeProviderId,
	activeTokenId: payload.activeTokenId ?? null,
	activeModel: payload.activeModel ?? null,
	providerConfigsById: {
		openrouter: payload.providerConfigsById.openrouter ?? {},
		ollama: payload.providerConfigsById.ollama ?? {},
	},
});

const isPresetPayloadEqual = (left: RagPreset['payload'], right: RagPreset['payload']): boolean =>
	JSON.stringify(normalizePayload(left)) === JSON.stringify(normalizePayload(right));

function buildAutosyncPreset(params: {
	runtime: RagRuntime | null;
	configs: Record<RagProviderId, RagProviderConfig>;
	presets: RagPreset[];
	presetSettings: RagPresetSettings | null;
}): RagPreset | null {
	if (!params.runtime || !params.presetSettings?.selectedId) return null;

	const selected = params.presets.find((item) => item.id === params.presetSettings?.selectedId) ?? null;
	if (!selected) return null;

	const payload = toPresetPayload(params.runtime, params.configs);
	if (isPresetPayloadEqual(selected.payload, payload)) {
		return null;
	}

	return {
		...selected,
		payload,
	};
}

export const ragMounted = createEvent();
export const ragProviderSelected = createEvent<RagProviderId>();
export const ragTokenSelected = createEvent<string | null>();
export const ragModelSelected = createEvent<string | null>();
export const ragPresetSelected = createEvent<string | null>();
export const ragModelsRefreshRequested = createEvent();
export const ragConfigPatched = createEvent<{ providerId: RagProviderId; config: RagProviderConfig }>();

export const loadProvidersFx = createEffect(async (): Promise<RagProviderDefinition[]> => ragApi.getRagProviders());
export const loadRuntimeFx = createEffect(async (): Promise<RagRuntime> => ragApi.getRagRuntime());
export const patchRuntimeFx = createEffect(async (payload: Partial<RagRuntime>): Promise<RagRuntime> => ragApi.patchRagRuntime(payload));
export const loadConfigFx = createEffect(
	async (providerId: RagProviderId): Promise<{ providerId: RagProviderId; config: RagProviderConfig }> =>
		ragApi.getRagProviderConfig(providerId),
);
export const patchConfigFx = createEffect(
	async (params: {
		providerId: RagProviderId;
		config: RagProviderConfig;
	}): Promise<{ providerId: RagProviderId; config: RagProviderConfig }> =>
		ragApi.patchRagProviderConfig(params.providerId, params.config),
);
export const loadTokensFx = createEffect(
	async (providerId: RagProviderId): Promise<{ providerId: RagProviderId; tokens: LlmTokenListItem[] }> => ({
		providerId,
		tokens: await ragApi.listRagTokens(providerId),
	}),
);
export const loadModelsFx = createEffect(
	async (params: { providerId: RagProviderId; tokenId: string | null }): Promise<{ key: string; models: RagModel[] }> => ({
		key: toProviderTokenKey(params.providerId, params.tokenId),
		models: await ragApi.listRagModels(params),
	}),
);

export const loadPresetsFx = createEffect(async (): Promise<RagPreset[]> => ragApi.listRagPresets());
export const createPresetFx = createEffect(
	async (input: { name: string; payload: RagPreset['payload'] }): Promise<RagPreset> =>
		ragApi.createRagPreset({
			id: uuidv4(),
			name: input.name,
			payload: input.payload,
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		}),
);
export const updatePresetFx = createEffect(async (input: RagPreset): Promise<RagPreset> =>
	ragApi.updateRagPreset({ ...input, updatedAt: new Date().toISOString() }),
);
export const deletePresetFx = createEffect(async (id: string): Promise<{ id: string }> => ragApi.deleteRagPreset(id));
export const applyPresetFx = createEffect(async (id: string): Promise<{ preset: RagPreset | null }> => ragApi.applyRagPreset(id));

export const loadPresetSettingsFx = createEffect(async (): Promise<RagPresetSettings> => ragApi.getRagPresetSettings());
export const patchPresetSettingsFx = createEffect(async (input: RagPresetSettings): Promise<RagPresetSettings> => ragApi.patchRagPresetSettings(input));

const ragStatePatched = createEvent();
const ragStatePatchedDebounced = debounce({ source: ragStatePatched, timeout: 600 });

export const $providers = createStore<RagProviderDefinition[]>([]);
export const $runtime = createStore<RagRuntime | null>(null);
export const $configs = createStore<Record<RagProviderId, RagProviderConfig>>({} as Record<RagProviderId, RagProviderConfig>);
export const $tokens = createStore<Record<RagProviderId, LlmTokenListItem[]>>({} as Record<RagProviderId, LlmTokenListItem[]>);
export const $modelsByProviderTokenKey = createStore<Record<string, RagModel[]>>({});
export const $presets = createStore<RagPreset[]>([]);
export const $presetSettings = createStore<RagPresetSettings | null>(null);

$providers.on(loadProvidersFx.doneData, (_, x) => x);
$runtime.on(loadRuntimeFx.doneData, (_, x) => x).on(patchRuntimeFx.doneData, (_, x) => x);
$configs
	.on(loadConfigFx.doneData, (s, x) => ({ ...s, [x.providerId]: x.config }))
	.on(patchConfigFx.doneData, (s, x) => ({ ...s, [x.providerId]: x.config }));
$tokens.on(loadTokensFx.doneData, (s, x) => ({ ...s, [x.providerId]: x.tokens }));
$modelsByProviderTokenKey.on(loadModelsFx.doneData, (s, x) => ({ ...s, [x.key]: x.models }));
$presets.on(loadPresetsFx.doneData, (_, x) => x);
$presetSettings.on(loadPresetSettingsFx.doneData, (_, x) => x).on(patchPresetSettingsFx.doneData, (_, x) => x);

sample({ clock: ragMounted, target: [loadProvidersFx, loadRuntimeFx, loadPresetsFx, loadPresetSettingsFx] });

sample({
	clock: [loadRuntimeFx.doneData, patchRuntimeFx.doneData],
	fn: (runtime) => runtime.activeProviderId,
	target: [loadConfigFx, loadTokensFx],
});

sample({
	clock: [loadRuntimeFx.doneData, patchRuntimeFx.doneData],
	filter: (runtime) => Boolean(runtime.activeTokenId),
	fn: (runtime) => ({
		providerId: runtime.activeProviderId,
		tokenId: runtime.activeTokenId,
	}),
	target: loadModelsFx,
});

sample({ clock: ragProviderSelected, fn: (providerId) => ({ activeProviderId: providerId, activeTokenId: null, activeModel: null }), target: patchRuntimeFx });
sample({ clock: ragProviderSelected, target: [loadConfigFx, loadTokensFx] });

sample({
	clock: ragTokenSelected,
	source: $runtime,
	fn: (runtime, tokenId) => ({
		activeProviderId: runtime?.activeProviderId ?? 'openrouter',
		activeTokenId: tokenId,
		activeModel: runtime?.activeModel ?? null,
	}),
	target: patchRuntimeFx,
});

sample({
	clock: ragModelSelected,
	source: $runtime,
	fn: (runtime, model) => ({
		activeProviderId: runtime?.activeProviderId ?? 'openrouter',
		activeTokenId: runtime?.activeTokenId ?? null,
		activeModel: model,
	}),
	target: patchRuntimeFx,
});

sample({ clock: ragConfigPatched, target: patchConfigFx });

sample({
	clock: ragModelsRefreshRequested,
	source: $runtime,
	filter: (runtime) => Boolean(runtime?.activeTokenId),
	fn: (runtime) => ({
		providerId: runtime?.activeProviderId ?? 'openrouter',
		tokenId: runtime?.activeTokenId ?? null,
	}),
	target: loadModelsFx,
});

sample({
	clock: ragPresetSelected,
	fn: (selectedId) => ({ selectedId }),
	target: patchPresetSettingsFx,
});

sample({
	clock: ragPresetSelected,
	filter: (selectedId): selectedId is string => Boolean(selectedId),
	target: applyPresetFx,
});

sample({ clock: [createPresetFx.doneData, updatePresetFx.doneData, deletePresetFx.done], target: [loadPresetsFx, loadPresetSettingsFx] });
sample({ clock: applyPresetFx.done, target: [loadRuntimeFx, loadPresetsFx, loadPresetSettingsFx] });

sample({ clock: [patchRuntimeFx.doneData, patchConfigFx.doneData], fn: () => undefined, target: ragStatePatched });
sample({
	clock: ragStatePatchedDebounced,
	source: {
		runtime: $runtime,
		configs: $configs,
		presets: $presets,
		presetSettings: $presetSettings,
	},
	filter: (state) => Boolean(buildAutosyncPreset(state)),
	fn: (state) => buildAutosyncPreset(state) as RagPreset,
	target: updatePresetFx,
});

sample({
	clock: createPresetFx.doneData,
	fn: (preset) => preset.id,
	target: ragPresetSelected,
});

export const ragProviderModel = {
	$providers,
	$runtime,
	$configs,
	$tokens,
	$modelsByProviderTokenKey,
	$presets,
	$presetSettings,
	ragMounted,
	ragProviderSelected,
	ragTokenSelected,
	ragModelSelected,
	ragPresetSelected,
	ragModelsRefreshRequested,
	ragConfigPatched,
	loadConfigFx,
	patchConfigFx,
	loadModelsFx,
	createPresetFx,
	updatePresetFx,
	deletePresetFx,
	applyPresetFx,
	patchPresetSettingsFx,
};
