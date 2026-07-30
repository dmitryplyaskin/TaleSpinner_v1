import { ActionIcon, Box, Group, Title } from '@mantine/core';

import { CornersInIcon, CornersOutIcon, SidebarSimpleIcon, XIcon } from '@ui/icons';

import type { ReactNode } from 'react';

type SidebarShellProps = {
	title: string;
	children: ReactNode;
	isFullscreen: boolean;
	placement: 'start' | 'end';
	onToggleFullscreen: () => void;
	onTogglePlacement: () => void;
	onClose: () => void;
	contentClassName?: string;
	labels: {
		toggleFullscreen: string;
		togglePlacement: string;
		close: string;
	};
};

export const SidebarShell = ({
	title,
	children,
	isFullscreen,
	placement,
	onToggleFullscreen,
	onTogglePlacement,
	onClose,
	contentClassName = '',
	labels,
}: SidebarShellProps) => {
	const contentClasses = ['ts-sidebar-shell__content', 'ts-scrollbar-thin', contentClassName].filter(Boolean).join(' ');

	return (
		<Box className="ts-sidebar-shell">
			<Group justify="space-between" align="center" wrap="nowrap" className="ts-sidebar-shell__header">
				<Title order={4} style={{ lineHeight: 1.2 }}>
					{title}
				</Title>

				<Box className="ts-sidebar-shell__controls">
					<ActionIcon aria-label={labels.toggleFullscreen} variant={isFullscreen ? 'filled' : 'subtle'} onClick={onToggleFullscreen}>
						{isFullscreen ? <CornersInIcon /> : <CornersOutIcon />}
					</ActionIcon>
					<ActionIcon aria-label={labels.togglePlacement} variant="subtle" onClick={onTogglePlacement}>
						<SidebarSimpleIcon mirrored={placement === 'start'} />
					</ActionIcon>
					<ActionIcon aria-label={labels.close} variant="subtle" onClick={onClose}>
						<XIcon />
					</ActionIcon>
				</Box>
			</Group>

			<Box className={contentClasses}>{children}</Box>
		</Box>
	);
};
