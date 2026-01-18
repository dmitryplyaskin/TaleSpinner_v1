import { ActionIcon, Tooltip, type ActionIconProps, type ElementProps, type TooltipProps } from '@mantine/core';
import type { ReactElement, ReactNode } from 'react';

type ChakraCompatVariant = 'ghost' | 'outline' | 'solid' | 'subtle';

type Props = Omit<ActionIconProps, 'children'> &
	ElementProps<'button', keyof ActionIconProps> & {
	tooltip: ReactNode;
	tooltipSettings?: Omit<TooltipProps, 'children' | 'label'>;
	icon: ReactElement;
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

export const IconButtonWithTooltip = ({
	icon,
	tooltip,
	tooltipSettings,
	colorPalette,
	variant,
	...buttonProps
}: Props) => {
	const ariaLabel = buttonProps['aria-label'] || 'icon-button';

	return (
		<Tooltip label={tooltip} openDelay={100} {...tooltipSettings}>
			<ActionIcon
				{...buttonProps}
				aria-label={ariaLabel}
				color={colorPalette ?? (buttonProps.color as string | undefined)}
				variant={mapVariant(variant)}
			>
				{icon}
			</ActionIcon>
		</Tooltip>
	);
};
