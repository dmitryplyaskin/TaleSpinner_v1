import { createEffect, createEvent, createStore, sample } from 'effector';

import { fetchAppSettingsFx } from './app-settings';
import { loadEntityProfilesFx } from './chat-core';
import { instructionsModel } from './instructions';
import { fetchSettingsFx as fetchLlmSettingsFx } from './llm-settings';
import { pipelinesModel } from './pipelines';
import { llmProviderModel } from './provider';
import { samplersModel } from './samplers';
import { getSettingsFx as fetchSidebarsFx } from './sidebars';
import { templatesModel } from './template';
import { userPersonsModel } from './user-persons';

export const appStarted = createEvent();

export const appInitFx = createEffect(async (): Promise<void> => {
	await Promise.all([
		// UI state
		fetchSidebarsFx(),
		fetchAppSettingsFx(),
		fetchLlmSettingsFx(),

		// Data models (settings + items)
		loadEntityProfilesFx(),
		instructionsModel.getSettingsFx(),
		instructionsModel.getItemsFx(),
		pipelinesModel.getSettingsFx(),
		pipelinesModel.getItemsFx(),
		templatesModel.getSettingsFx(),
		templatesModel.getItemsFx(),
		userPersonsModel.getSettingsFx(),
		userPersonsModel.getItemsFx(),
		samplersModel.getSettingsFx(),
		samplersModel.getItemsFx(),

		// LLM provider runtime (needed for auto models load)
		llmProviderModel.loadProvidersFx(),
		llmProviderModel.loadRuntimeFx({ scope: 'global', scopeId: 'global' }),
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
