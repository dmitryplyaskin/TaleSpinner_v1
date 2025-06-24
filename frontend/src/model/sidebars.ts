import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../api-routes';
import { asyncHandler } from './utils/async-handler';

export type SidebarName =
	| 'settings'
	| 'agentCards'
	| 'userPersons'
	| 'pipeline'
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

export type SidebarSettings = {
	[key in SidebarName]: SidebarSetting;
};

export const $sidebars = createStore<SidebarSettings>({
	settings: {
		isOpen: false,
		isFullscreen: false,
		placement: 'start',
		size: 'lg',
		contained: false,
	},
	agentCards: {
		isOpen: false,
		isFullscreen: false,
		placement: 'start',
		size: 'lg',
		contained: false,
	},
	userPersons: {
		isOpen: false,
		isFullscreen: false,
		placement: 'start',
		size: 'lg',
		contained: false,
	},
	pipeline: {
		isOpen: false,
		isFullscreen: false,
		placement: 'start',
		size: 'lg',
		contained: false,
	},
	instructions: {
		isOpen: false,
		isFullscreen: false,
		placement: 'start',
		size: 'lg',
	},
	templates: {
		isOpen: false,
		isFullscreen: false,
		placement: 'start',
		size: 'lg',
	},
	appSettings: {
		isOpen: false,
		isFullscreen: true,
		placement: 'start',
		size: 'full',
		contained: false,
	},
});

// Создаем отдельное событие для изменения isOpen
export const toggleSidebarOpen = createEvent<{ name: SidebarName; isOpen: boolean }>();

// Создаем событие для изменения других настроек (кроме isOpen)
export const changeSidebarSettings = createEvent<{ name: SidebarName; settings: Partial<SidebarSetting> }>();

// Обрабатываем изменение isOpen отдельно
$sidebars.on(toggleSidebarOpen, (sidebars, { name, isOpen }) => ({
	...sidebars,
	[name]: {
		...sidebars[name],
		isOpen,
	},
}));

// Обрабатываем изменение других настроек
$sidebars.on(changeSidebarSettings, (sidebars, { name, settings }) => {
	// Исключаем isOpen из настроек, чтобы не перезаписать его случайно
	const { isOpen, ...otherSettings } = settings;

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
		const response = await fetch(apiRoutes.sidebars.save(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(newSettings),
		});
		return response.json();
	}, 'Error saving settings'),
);

export const getSettingsFx = createEffect<void, SidebarSettings>(() =>
	asyncHandler(async () => {
		const response = await fetch(apiRoutes.sidebars.get()).then((response) => response.json());
		return response;
	}, 'Error getting settings'),
);

$sidebars.on(getSettingsFx.doneData, (_, payload) => payload);

// Сохраняем настройки только при изменении через changeSidebarSettings
sample({
	clock: changeSidebarSettings,
	source: $sidebars,
	target: saveSettingsFx,
});

getSettingsFx();
