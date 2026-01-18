import { type AppSettings } from '@shared/types/app-settings';
import { createStore, createEvent, createEffect, sample } from 'effector';
import { debounce } from 'patronum/debounce';

import { apiJson } from '../../api/api-json';

// Events
export const updateAppSettings = createEvent<Partial<AppSettings>>();
export const resetAppSettings = createEvent();

// Effects
export const fetchAppSettingsFx = createEffect(async () => {
	return apiJson<AppSettings>('/app-settings');
});

export const saveAppSettingsFx = createEffect(async (settings: AppSettings) => {
	return apiJson<AppSettings>('/app-settings', { method: 'POST', body: JSON.stringify(settings) });
});

// Default settings
const defaultAppSettings: AppSettings = {
	language: 'ru',
	openLastChat: false,
	autoSelectCurrentPersona: false,
};

// Store
export const $appSettings = createStore<AppSettings>(defaultAppSettings);

// Store updates
$appSettings
	.on(updateAppSettings, (state, payload) => ({
		...state,
		...payload,
	}))
	.on(fetchAppSettingsFx.doneData, (_, payload) => payload)
	.reset(resetAppSettings);

// Debounced save
const debouncedUpdateSettings = debounce({
	source: updateAppSettings,
	timeout: 500,
});

sample({
	source: $appSettings,
	clock: debouncedUpdateSettings,
	target: saveAppSettingsFx,
});
