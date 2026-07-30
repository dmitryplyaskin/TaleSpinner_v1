import { createEffect } from 'effector';

import * as llmApi from '../../api/llm';

import {
	cachePreset,
	cachePresetSettings,
	cacheProviderConfig,
	cacheRuntime,
} from './resource-effects';

import type {
	LlmPresetPayload,
	LlmProviderConfig,
	LlmProviderId,
	LlmScope,
	LlmTokenListItem,
} from '@shared/types/llm';

export const checkProviderConnectionFx = createEffect(
	async (params: {
		providerId: LlmProviderId;
		scope: LlmScope;
		scopeId: string;
		tokenId?: string | null;
		config?: LlmProviderConfig;
	}) => llmApi.checkProviderConnection(params),
);

export const createTokenFx = createEffect(
	async (params: { providerId: LlmProviderId; name: string; token: string }): Promise<LlmTokenListItem> =>
		llmApi.createToken(params),
);
export const patchTokenFx = createEffect((params: { id: string; name?: string; token?: string }): Promise<void> =>
	llmApi.patchToken(params),
);
export const deleteTokenFx = createEffect((id: string): Promise<void> => llmApi.deleteToken(id));

export const saveConnectionFx = createEffect(
	async (params: {
		scope: LlmScope;
		scopeId: string;
		providerId: LlmProviderId;
		tokenId: string | null;
		model: string | null;
		config: LlmProviderConfig;
		preset?: { presetId: string; payload: LlmPresetPayload };
	}) => {
		const config = await llmApi.patchProviderConfig(params.providerId, params.config);
		cacheProviderConfig(config);
		const runtime = await llmApi.patchRuntime({
			scope: params.scope,
			scopeId: params.scopeId,
			activeProviderId: params.providerId,
			activeTokenId: params.tokenId,
			activeModel: params.model,
		});
		cacheRuntime(runtime);
		const preset = params.preset
			? await llmApi.updateLlmPreset({
					presetId: params.preset.presetId,
					ownerId: 'global',
					payload: params.preset.payload,
				})
			: null;
		if (preset) cachePreset(preset);
		return { config, runtime, preset };
	},
);

export const createLlmPresetFx = createEffect(
	async (params: { name: string; description?: string; payload: LlmPresetPayload }): Promise<llmApi.LlmPresetDto> =>
		llmApi.createLlmPreset({ ownerId: 'global', ...params }),
);
export const updateLlmPresetFx = createEffect(
	async (params: {
		presetId: string;
		name?: string;
		description?: string | null;
		payload?: LlmPresetPayload;
	}): Promise<llmApi.LlmPresetDto> => llmApi.updateLlmPreset({ ownerId: 'global', ...params }),
);
export const deleteLlmPresetFx = createEffect((presetId: string) =>
	llmApi.deleteLlmPreset({ ownerId: 'global', presetId }),
);
export const applyLlmPresetFx = createEffect(
	async (params: { presetId: string; scope: LlmScope; scopeId: string }) => {
		const result = await llmApi.applyLlmPreset({ ownerId: 'global', ...params });
		cacheRuntime(result.runtime);
		return result;
	},
);
export const patchLlmPresetSettingsFx = createEffect(async (params: { activePresetId?: string | null }) => {
	const settings = await llmApi.patchLlmPresetSettings({ ownerId: 'global', ...params });
	cachePresetSettings(settings);
	return settings;
});
