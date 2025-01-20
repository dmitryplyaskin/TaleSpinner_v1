import { createEffect, createEvent, createStore, sample } from 'effector';
import { apiRoutes } from '../api-routes';

export type SidebarName = 'settings' | 'chatCards' | 'userPersons';

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
});

export const changeSidebarSettings = createEvent<{ name: SidebarName; settings: Partial<SidebarSetting> }>();

$sidebars.on(changeSidebarSettings, (sidebars, { name, settings }) => ({
	...sidebars,
	[name]: {
		...sidebars[name],
		...settings,
	},
}));

export const saveSettingsFx = createEffect<SidebarSettings, void>(async (settings) => {
	try {
		const response = await fetch(apiRoutes.sidebars.save(), {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(settings),
		});
		return response.json();
	} catch (error) {
		console.error('Error saving settings:', error);
		return null;
	}
});

export const getSettingsFx = createEffect<void, SidebarSettings>(async () => {
	try {
		const response = await fetch(apiRoutes.sidebars.get()).then((response) => response.json());
		return response;
	} catch (error) {
		console.error('Error getting settings:', error);
		return null;
	}
});

$sidebars.on(getSettingsFx.doneData, (_, payload) => payload);

sample({
	clock: $sidebars,
	target: saveSettingsFx,
});

getSettingsFx();
