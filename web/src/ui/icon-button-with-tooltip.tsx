import { ActionIcon, Tooltip, type ActionIconProps, type ElementProps, type TooltipProps } from '@mantine/core';
import { cloneElement, type ReactElement, type ReactNode } from 'react';

import { TOOLTIP_PORTAL_SETTINGS } from './z-index';

type ChakraCompatVariant = 'ghost' | 'outline' | 'solid' | 'subtle';

type Props = Omit<ActionIconProps, 'children'> &
	ElementProps<'button', keyof ActionIconProps> & {
		tooltip: ReactNode;
		tooltipSettings?: Omit<TooltipProps, 'children' | 'label'>;
		icon: ReactElement<{ size?: number }>;
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

function resolveIconSize(size: ActionIconProps['size'] | undefined, iconSize?: number): number {
	if (typeof iconSize === 'number') return iconSize;
	if (typeof size === 'number') return Math.max(14, Math.floor(size * 0.48));

	switch (size) {
		case 'input-sm':
			return 14;
		case 'input-md':
			return 16;
		case 'input-lg':
			return 17;
		case 'xs':
			return 14;
		case 'sm':
			return 16;
		case 'md':
			return 18;
		case 'lg':
			return 19;
		case 'xl':
			return 21;
		default:
			return 16;
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
	const normalizedIcon = cloneElement(icon, { size: icon.props.size ?? resolveIconSize(size, iconSize) });
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
