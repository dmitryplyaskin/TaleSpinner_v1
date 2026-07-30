import type { IconProps } from './icons';
import type { ActionIconProps } from '@mantine/core';

export const ICON_GRAPHIC_STYLE = {
	display: 'block',
	flexShrink: 0,
} as const;

export const ICON_CONTEXT_VALUE = {
	color: 'currentColor',
	size: 18,
	weight: 'bold',
	mirrored: false,
	style: ICON_GRAPHIC_STYLE,
} satisfies IconProps;

export function resolveIconSize(size: ActionIconProps['size'] | undefined, iconSize?: number): number {
	if (typeof iconSize === 'number') return iconSize;
	if (typeof size === 'number') return Math.max(16, Math.round(size * 0.625));

	switch (size) {
		case 'input-sm':
			return 18;
		case 'input-md':
			return 20;
		case 'input-lg':
			return 22;
		case 'xs':
			return 16;
		case 'sm':
			return 18;
		case 'md':
			return 20;
		case 'lg':
			return 22;
		case 'xl':
			return 24;
		default:
			return 18;
	}
}
