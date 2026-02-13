import { createEffect, createEvent, createStore, sample } from 'effector';
import { v4 as uuidv4 } from 'uuid';

import * as ragApi from '../../api/rag';

import type { LlmTokenListItem } from '@shared/types/llm';
import type {
	RagPreset,
	RagPresetSettings,
	RagProviderConfig,
	RagProviderDefinition,
	RagProviderId,
	RagRuntime,
} from '@shared/types/rag';

export const ragMounted = createEvent();
export const ragProviderSelected = createEvent<RagProviderId>();
export const ragTokenSelected = createEvent<string | null>();
export const ragModelSelected = createEvent<string | null>();

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

export const $providers = createStore<RagProviderDefinition[]>([]);
export const $runtime = createStore<RagRuntime | null>(null);
export const $configs = createStore<Record<RagProviderId, RagProviderConfig>>({} as Record<RagProviderId, RagProviderConfig>);
export const $tokens = createStore<Record<RagProviderId, LlmTokenListItem[]>>({} as Record<RagProviderId, LlmTokenListItem[]>);
export const $presets = createStore<RagPreset[]>([]);
export const $presetSettings = createStore<RagPresetSettings | null>(null);

$providers.on(loadProvidersFx.doneData, (_, x) => x);
$runtime.on(loadRuntimeFx.doneData, (_, x) => x).on(patchRuntimeFx.doneData, (_, x) => x);
$configs
	.on(loadConfigFx.doneData, (s, x) => ({ ...s, [x.providerId]: x.config }))
	.on(patchConfigFx.doneData, (s, x) => ({ ...s, [x.providerId]: x.config }));
$tokens.on(loadTokensFx.doneData, (s, x) => ({ ...s, [x.providerId]: x.tokens }));
$presets.on(loadPresetsFx.doneData, (_, x) => x);
$presetSettings.on(loadPresetSettingsFx.doneData, (_, x) => x).on(patchPresetSettingsFx.doneData, (_, x) => x);

sample({ clock: ragMounted, target: [loadProvidersFx, loadRuntimeFx, loadPresetsFx, loadPresetSettingsFx] });
sample({ clock: loadRuntimeFx.doneData, fn: (runtime) => runtime.activeProviderId, target: [loadConfigFx, loadTokensFx] });
sample({ clock: ragProviderSelected, fn: (providerId) => ({ activeProviderId: providerId, activeTokenId: null, activeModel: null }), target: patchRuntimeFx });
sample({ clock: ragProviderSelected, target: [loadConfigFx, loadTokensFx] });
sample({
	clock: ragTokenSelected,
	source: $runtime,
	fn: (runtime, tokenId) => ({
		activeProviderId: runtime?.activeProviderId ?? 'openrouter',
		activeTokenId: tokenId,
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
sample({ clock: [createPresetFx.doneData, updatePresetFx.doneData, deletePresetFx.done, applyPresetFx.done], target: [loadPresetsFx, loadRuntimeFx] });

export const ragProviderModel = {
	$providers,
	$runtime,
	$configs,
	$tokens,
	$presets,
	$presetSettings,
	ragMounted,
	ragProviderSelected,
	ragTokenSelected,
	ragModelSelected,
	loadConfigFx,
	patchConfigFx,
	createPresetFx,
	updatePresetFx,
	deletePresetFx,
	applyPresetFx,
	patchPresetSettingsFx,
};
