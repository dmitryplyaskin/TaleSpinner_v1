import { ActionIcon, Box, Group, Title } from '@mantine/core';
import type { ReactNode } from 'react';
import { LuArrowLeftToLine, LuArrowRightToLine, LuFullscreen, LuMinimize2, LuX } from 'react-icons/lu';

type SidebarShellProps = {
	title: string;
	children: ReactNode;
	isFullscreen: boolean;
	placement: 'start' | 'end';
	onToggleFullscreen: () => void;
	onTogglePlacement: () => void;
	onClose: () => void;
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
	labels,
}: SidebarShellProps) => {
	return (
		<Box className="ts-sidebar-shell">
			<Group justify="space-between" align="center" wrap="nowrap" className="ts-sidebar-shell__header">
				<Title order={4} style={{ lineHeight: 1.2 }}>
					{title}
				</Title>

				<Box className="ts-sidebar-shell__controls">
					<ActionIcon aria-label={labels.toggleFullscreen} variant={isFullscreen ? 'filled' : 'subtle'} onClick={onToggleFullscreen}>
						{isFullscreen ? <LuMinimize2 /> : <LuFullscreen />}
					</ActionIcon>
					<ActionIcon aria-label={labels.togglePlacement} variant="subtle" onClick={onTogglePlacement}>
						{placement === 'start' ? <LuArrowRightToLine /> : <LuArrowLeftToLine />}
					</ActionIcon>
					<ActionIcon aria-label={labels.close} variant="subtle" onClick={onClose}>
						<LuX />
					</ActionIcon>
				</Box>
			</Group>

			<Box className="ts-sidebar-shell__content ts-scrollbar-thin">{children}</Box>
		</Box>
	);
};
