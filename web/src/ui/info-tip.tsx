import { ActionIcon, Popover, type PopoverProps } from '@mantine/core';
import type { ReactNode } from 'react';
import { HiOutlineInformationCircle } from 'react-icons/hi';

export interface InfoTipProps extends Omit<PopoverProps, 'children'> {
	content: ReactNode;
	ariaLabel?: string;
}

export const InfoTip = ({ content, ariaLabel = 'info', ...popoverProps }: InfoTipProps) => {
	return (
		<Popover withinPortal zIndex={4000} shadow="md" position="top" withArrow {...popoverProps}>
			<Popover.Target>
				<ActionIcon variant="subtle" color="gray" size="sm" aria-label={ariaLabel}>
					<HiOutlineInformationCircle />
				</ActionIcon>
			</Popover.Target>
			<Popover.Dropdown>{content}</Popover.Dropdown>
		</Popover>
	);
};

