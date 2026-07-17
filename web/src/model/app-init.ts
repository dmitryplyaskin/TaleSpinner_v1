import { createEffect, createEvent, createStore, sample } from 'effector';

import './chat-core/auto-select-current-persona';

import { loadAppBackgroundCatalogFx } from './app-backgrounds';
import { fetchAppSettingsFx } from './app-settings';
import { loadEntityProfilesFx } from './chat-core';
import { instructionsInitRequested } from './instructions';
import { fetchSettingsFx as fetchLlmSettingsFx } from './llm-settings';
import { llmProviderModel } from './provider';
import { samplersModel } from './samplers';
import { getSettingsFx as fetchSidebarsFx } from './sidebars';
import { loadUiThemePresetsFx, loadUiThemeSettingsFx } from './ui-themes';
import { userPersonsModel } from './user-persons';
import { worldInfoInitRequested } from './world-info';

export const appStarted = createEvent();

export const appInitFx = createEffect(async (): Promise<void> => {
	// Instructions are global; load once on app start.
	instructionsInitRequested();
	worldInfoInitRequested();
	const globalRuntimePromise = llmProviderModel.ensureRuntimeFx({ scope: 'global', scopeId: 'global' });

	await Promise.all([
		// UI state
		fetchSidebarsFx(),
		fetchAppSettingsFx(),
		loadAppBackgroundCatalogFx(),
		fetchLlmSettingsFx(),
		loadUiThemePresetsFx(),
		loadUiThemeSettingsFx(),

		// Data models (settings + items)
		loadEntityProfilesFx(),
		userPersonsModel.getSettingsFx(),
		userPersonsModel.getItemsFx(),
		samplersModel.getSettingsFx(),
		samplersModel.getItemsFx(),

		// LLM provider runtime (needed for auto models load)
		llmProviderModel.ensureProvidersFx(),
		llmProviderModel.ensureLlmPresetsFx(),
		llmProviderModel.ensureLlmPresetSettingsFx(),
		globalRuntimePromise,
	]);

	const runtime = await globalRuntimePromise;
	await Promise.all([
		llmProviderModel.ensureTokensFx(runtime.activeProviderId),
		llmProviderModel.ensureProviderConfigFx(runtime.activeProviderId),
		runtime.activeTokenId
			? llmProviderModel.ensureModelsFx({
					providerId: runtime.activeProviderId,
					scope: runtime.scope,
					scopeId: runtime.scopeId,
					tokenId: runtime.activeTokenId,
				})
			: Promise.resolve(),
	]);
});

export const $appInitError = createStore<string | null>(null)
	.on(appInitFx.failData, (_, error) => (error instanceof Error ? error.message : String(error)))
	.reset(appStarted, appInitFx.done);

export const $appInitPending = appInitFx.pending;

export const $isAppReady = createStore(false)
	.on(appInitFx.done, () => true)
	.reset(appStarted);

sample({
	clock: appStarted,
	target: appInitFx,
});
