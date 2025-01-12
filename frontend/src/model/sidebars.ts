import { createEvent, createStore } from 'effector';

type Sidebars = {
	settings: boolean;
	chatCards: boolean;
	userPersons: boolean;
};

export const $sidebars = createStore<Sidebars>({
	settings: false,
	chatCards: false,
	userPersons: false,
});

export const openSidebar = createEvent<keyof Sidebars>();
export const closeSidebar = createEvent<keyof Sidebars>();

$sidebars
	.on(openSidebar, (sidebars, sidebar) => ({
		...sidebars,
		[sidebar]: true,
	}))
	.on(closeSidebar, (sidebars, sidebar) => ({
		...sidebars,
		[sidebar]: false,
	}));
