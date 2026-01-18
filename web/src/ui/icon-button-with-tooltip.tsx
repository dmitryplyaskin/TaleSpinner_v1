import { ActionIcon, Tooltip, type ActionIconProps, type ElementProps, type TooltipProps } from '@mantine/core';
import { cloneElement, type ReactElement, type ReactNode } from 'react';

type ChakraCompatVariant = 'ghost' | 'outline' | 'solid' | 'subtle';

type Props = Omit<ActionIconProps, 'children'> &
	ElementProps<'button', keyof ActionIconProps> & {
	tooltip: ReactNode;
	tooltipSettings?: Omit<TooltipProps, 'children' | 'label'>;
	icon: ReactElement<{ size?: number }>;
	iconSize?: number;
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

	// Chakra compatibility: map common names to Mantine palette.
	switch (color) {
		case 'purple':
			return 'violet';
		default:
			return color;
	}
}

export const IconButtonWithTooltip = ({
	icon,
	iconSize = 16,
	tooltip,
	tooltipSettings,
	colorPalette,
	variant,
	...buttonProps
}: Props) => {
	const ariaLabel = buttonProps['aria-label'] || 'icon-button';
	const normalizedIcon = cloneElement(icon, { size: icon.props.size ?? iconSize });

	return (
		<Tooltip label={tooltip} openDelay={100} {...tooltipSettings}>
			<ActionIcon
				{...buttonProps}
				aria-label={ariaLabel}
				color={mapColor(colorPalette ?? (buttonProps.color as string | undefined))}
				variant={mapVariant(variant)}
			>
				{normalizedIcon}
			</ActionIcon>
		</Tooltip>
	);
};
