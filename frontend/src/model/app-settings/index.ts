import { createStore, createEvent, createEffect, sample } from 'effector';
import { debounce } from 'patronum/debounce';
import { BASE_URL } from '../../const';
import { AppSettings } from '@shared/types/app-settings';

// Events
export const updateAppSettings = createEvent<Partial<AppSettings>>();
export const resetAppSettings = createEvent();

// Effects
export const fetchAppSettingsFx = createEffect(async () => {
	const response = await fetch(`${BASE_URL}/app-settings`);
	if (!response.ok) {
		throw new Error('Failed to fetch app settings');
	}
	return response.json();
});

export const saveAppSettingsFx = createEffect(async (settings: AppSettings) => {
	const response = await fetch(`${BASE_URL}/app-settings`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(settings),
	});
	if (!response.ok) {
		throw new Error('Failed to save app settings');
	}
	return response.json();
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

// Initialize settings on app start
fetchAppSettingsFx();
