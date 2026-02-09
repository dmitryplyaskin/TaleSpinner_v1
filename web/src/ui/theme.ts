import { createTheme } from '@mantine/core';

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
			},
		},
		Drawer: {
			defaultProps: {
				radius: 'md',
				padding: 0,
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
