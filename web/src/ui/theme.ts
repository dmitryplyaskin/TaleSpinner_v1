import { createTheme } from '@mantine/core';

import { Z_INDEX } from './z-index';

export const appTheme = createTheme({
	primaryColor: 'cyan',
	defaultRadius: 'md',
	fontFamily: "'Manrope', 'Segoe UI Variable Text', 'Trebuchet MS', sans-serif",
	headings: {
		fontFamily: "'Manrope', 'Segoe UI Variable Text', 'Trebuchet MS', sans-serif",
		fontWeight: '700',
	},
	radius: {
		xs: '6px',
		sm: '10px',
		md: '14px',
		lg: '18px',
		xl: '22px',
	},
	components: {
		Button: {
			defaultProps: {
				radius: 'md',
				size: 'sm',
			},
		},
		ActionIcon: {
			defaultProps: {
				radius: 'md',
				variant: 'subtle',
			},
		},
		Paper: {
			defaultProps: {
				radius: 'md',
			},
		},
		Card: {
			defaultProps: {
				radius: 'md',
			},
		},
		Modal: {
			defaultProps: {
				radius: 'md',
				shadow: 'lg',
				padding: 'md',
				zIndex: Z_INDEX.overlay.modal,
			},
		},
		Drawer: {
			defaultProps: {
				radius: 'md',
				padding: 0,
				zIndex: Z_INDEX.overlay.drawer,
			},
		},
		Tooltip: {
			defaultProps: {
				withinPortal: true,
				zIndex: Z_INDEX.overlay.popup,
			},
		},
		Popover: {
			defaultProps: {
				withinPortal: true,
				zIndex: Z_INDEX.overlay.popup,
			},
		},
		Menu: {
			defaultProps: {
				withinPortal: true,
				zIndex: Z_INDEX.overlay.popup,
			},
		},
		TextInput: {
			defaultProps: {
				radius: 'md',
			},
		},
		Textarea: {
			defaultProps: {
				radius: 'md',
			},
		},
		Select: {
			defaultProps: {
				radius: 'md',
			},
		},
	},
});
