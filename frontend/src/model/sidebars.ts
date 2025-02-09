import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../api-routes';
import { asyncHandler } from './utils/async-handler';

export type SidebarName = 'settings' | 'chatCards' | 'userPersons' | 'pipeline' | 'instructions' | 'templates';

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
	chatCards: {
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
});

export const changeSidebarSettings = createEvent<{ name: SidebarName; settings: Partial<SidebarSetting> }>();

$sidebars.on(changeSidebarSettings, (sidebars, { name, settings }) => ({
	...sidebars,
	[name]: {
		...sidebars[name],
		...settings,
	},
}));

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

sample({
	clock: $sidebars,
	target: saveSettingsFx,
});

getSettingsFx();
