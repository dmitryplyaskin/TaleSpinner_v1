import { IconButton, IconButtonProps } from '@chakra-ui/react';
import { Tooltip, TooltipProps } from './chakra-core-ui/tooltip';

export const IconButtonWithTooltip: React.FC<
	IconButtonProps & {
		tooltip: React.ReactNode;
		tooltipSettings?: TooltipProps;
		icon: React.ReactElement;
	}
> = ({ icon, tooltip, tooltipSettings, ...buttonProps }) => {
	return (
		<Tooltip openDelay={100} {...tooltipSettings} content={tooltip}>
			<IconButton {...buttonProps}>{icon}</IconButton>
		</Tooltip>
	);
};
