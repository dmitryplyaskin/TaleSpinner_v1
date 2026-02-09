export const Z_INDEX = {
	local: {
		messageActionBar: 2,
	},
	overlay: {
		// Base layer for standard drawers and modals.
		drawer: 3000,
		// Standard dialogs above drawer layer.
		modal: 3200,
		// Nested dialogs above modal layer.
		modalChild: 3400,
		// Dedicated fullscreen textarea modal layer.
		textareaModal: 3600,
		// Popups/tooltips/menus/popovers above all regular modals.
		popup: 4200,
		// Highest priority layer for alerts/notifications.
		alert: 5000,
	},
	flow: {
		node: 100,
		groupOverlay: 10,
		groupLabel: 2000,
	},
} as const;

export const TOOLTIP_PORTAL_SETTINGS = {
	withinPortal: true,
	zIndex: Z_INDEX.overlay.popup,
} as const;
