import { createEffect, createEvent, createStore, sample } from 'effector';

import { apiJson } from '../api/api-json';

import { asyncHandler } from './utils/async-handler';

export type SidebarName =
	| 'settings'
	| 'agentCards'
	| 'userPersons'
	| 'pipeline'
	| 'operationProfiles'
	| 'instructions'
	| 'templates'
	| 'appSettings';

export type SidebarSetting = {
	isOpen: boolean;
	isFullscreen: boolean;
	placement: 'start' | 'end';
	size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
	contained?: boolean;
};

export type SidebarSettings = Record<string, SidebarSetting>;

const defaultSidebarSetting: SidebarSetting = {
	isOpen: false,
	isFullscreen: false,
	placement: 'start',
	size: 'lg',
	contained: false,
};

export const defaultSidebars: SidebarSettings = {
	settings: {
		...defaultSidebarSetting,
	},
	agentCards: {
		...defaultSidebarSetting,
	},
	userPersons: {
		...defaultSidebarSetting,
	},
	pipeline: {
		...defaultSidebarSetting,
	},
	operationProfiles: {
		...defaultSidebarSetting,
	},
	instructions: {
		...defaultSidebarSetting,
	},
	templates: {
		...defaultSidebarSetting,
	},
	appSettings: {
		...defaultSidebarSetting,
		isFullscreen: true,
		size: 'full',
	},
};

function mergeSidebarsState(defaults: SidebarSettings, incoming: SidebarSettings): SidebarSettings {
	const result: SidebarSettings = { ...defaults, ...incoming };
	for (const key of Object.keys(result)) {
		const base = defaults[key] ?? defaultSidebarSetting;
		const inc = incoming[key] ?? {};
		result[key] = { ...base, ...inc };
	}
	return result;
}

export const $sidebars = createStore<SidebarSettings>(defaultSidebars);

// Создаем отдельное событие для изменения isOpen
export const toggleSidebarOpen = createEvent<{ name: SidebarName; isOpen: boolean }>();

// Создаем событие для изменения других настроек (кроме isOpen)
export const changeSidebarSettings = createEvent<{ name: SidebarName; settings: Partial<SidebarSetting> }>();

// Обрабатываем изменение isOpen отдельно
$sidebars.on(toggleSidebarOpen, (sidebars, { name, isOpen }) => ({
	...sidebars,
	[name]: {
		...(sidebars[name] ?? defaultSidebars[name] ?? defaultSidebarSetting),
		isOpen,
	},
}));

// Обрабатываем изменение других настроек
$sidebars.on(changeSidebarSettings, (sidebars, { name, settings }) => {
	// Исключаем isOpen из настроек, чтобы не перезаписать его случайно
	const { isOpen: _isOpen, ...otherSettings } = settings;

	return {
		...sidebars,
		[name]: {
			...sidebars[name],
			...otherSettings,
		},
	};
});

export const saveSettingsFx = createEffect<SidebarSettings, void>((settings) =>
	asyncHandler(async () => {
		const newSettings = { ...settings };
		Object.keys(newSettings).forEach((key) => {
			newSettings[key as keyof SidebarSettings] = {
				...newSettings[key as keyof SidebarSettings],
				isOpen: false,
			};
		});
		await apiJson<SidebarSettings>('/sidebars', { method: 'POST', body: JSON.stringify(newSettings) });
	}, 'Error saving settings'),
);

export const getSettingsFx = createEffect<void, SidebarSettings>(() =>
	asyncHandler(async () => {
		return apiJson<SidebarSettings>('/sidebars');
	}, 'Error getting settings'),
);

$sidebars.on(getSettingsFx.doneData, (_, payload) => mergeSidebarsState(defaultSidebars, payload));

// Сохраняем настройки только при изменении через changeSidebarSettings
sample({
	clock: changeSidebarSettings,
	source: $sidebars,
	target: saveSettingsFx,
});
