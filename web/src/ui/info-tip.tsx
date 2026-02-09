import { ActionIcon, Popover, type PopoverProps } from '@mantine/core';
import { HiOutlineInformationCircle } from 'react-icons/hi';

import { Z_INDEX } from './z-index';

import type { ReactNode } from 'react';

export interface InfoTipProps extends Omit<PopoverProps, 'children'> {
	content: ReactNode;
	ariaLabel?: string;
}

export const InfoTip = ({ content, ariaLabel = 'info', ...popoverProps }: InfoTipProps) => {
	return (
		<Popover withinPortal zIndex={Z_INDEX.overlay.popup} shadow="md" position="top" withArrow {...popoverProps}>
			<Popover.Target>
				<ActionIcon variant="subtle" color="gray" size="sm" aria-label={ariaLabel}>
					<HiOutlineInformationCircle />
				</ActionIcon>
			</Popover.Target>
			<Popover.Dropdown>{content}</Popover.Dropdown>
		</Popover>
	);
};

