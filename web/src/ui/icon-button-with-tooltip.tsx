import { ActionIcon, Tooltip, type ActionIconProps, type ElementProps, type TooltipProps } from '@mantine/core';
import { cloneElement, type ReactElement, type ReactNode } from 'react';

import { ICON_GRAPHIC_STYLE, resolveIconSize } from './icon-presentation';
import { TOOLTIP_PORTAL_SETTINGS } from './z-index';

import type { IconProps } from './icons';

type ChakraCompatVariant = 'ghost' | 'outline' | 'solid' | 'subtle';

type Props = Omit<ActionIconProps, 'children'> &
	ElementProps<'button', keyof ActionIconProps> & {
		tooltip: ReactNode;
		tooltipSettings?: Omit<TooltipProps, 'children' | 'label'>;
		icon: ReactElement<IconProps>;
		iconSize?: number;
		active?: boolean;
		/** Chakra compatibility */
		colorPalette?: string;
		/** Chakra compatibility */
		variant?: ChakraCompatVariant;
	};

function mapVariant(variant?: ChakraCompatVariant): ActionIconProps['variant'] {
	switch (variant) {
		case 'ghost':
			return 'subtle';
		case 'solid':
			return 'filled';
		case 'outline':
			return 'outline';
		case 'subtle':
			return 'subtle';
		default:
			return undefined;
	}
}

function mapColor(color?: string): string | undefined {
	if (!color) return undefined;

	switch (color) {
		case 'purple':
			return 'indigo';
		default:
			return color;
	}
}

export const IconButtonWithTooltip = ({
	icon,
	tooltip,
	tooltipSettings,
	colorPalette,
	variant,
	active = false,
	iconSize,
	className,
	size,
	...buttonProps
}: Props) => {
	const ariaLabel = buttonProps['aria-label'] || 'icon-button';
	const normalizedIcon = cloneElement(icon, {
		'aria-hidden': true,
		focusable: false,
		size: icon.props.size ?? resolveIconSize(size, iconSize),
		weight: icon.props.weight ?? (active ? 'fill' : 'bold'),
		style: {
			...ICON_GRAPHIC_STYLE,
			...icon.props.style,
		},
	});
	const resolvedTooltipSettings = { ...TOOLTIP_PORTAL_SETTINGS, ...tooltipSettings };

	return (
		<Tooltip label={tooltip} openDelay={100} {...resolvedTooltipSettings}>
			<ActionIcon
				{...buttonProps}
				size={size}
				className={['ts-icon-button', className].filter(Boolean).join(' ')}
				data-active={active || undefined}
				aria-label={ariaLabel}
				color={mapColor(colorPalette ?? (buttonProps.color as string | undefined))}
				variant={mapVariant(variant) ?? 'subtle'}
			>
				{normalizedIcon}
			</ActionIcon>
		</Tooltip>
	);
};
