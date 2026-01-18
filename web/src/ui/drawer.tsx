import { ActionIcon, Drawer as MantineDrawer, Group, Title } from '@mantine/core';
import { useStoreMap } from 'effector-react';
import type { ReactNode } from 'react';
import { LuArrowRightToLine, LuArrowLeftToLine, LuFullscreen } from 'react-icons/lu';

import { $sidebars, changeSidebarSettings, type SidebarName, toggleSidebarOpen } from '@model/sidebars';

type Props = {
	name: SidebarName;
	title: string;
	children: ReactNode;
	defaultSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
	defaultPlacement?: 'start' | 'end' | 'top' | 'bottom';
	contained?: boolean;
};

export const Drawer = ({ name, title, children }: Props) => {
	const sidebar = useStoreMap({
		store: $sidebars,
		keys: [name],
		fn: (sidebars, [key]) => sidebars[key],
	});

	const { isOpen, isFullscreen, placement, size, contained } = sidebar;

	const handleClose = () => {
		toggleSidebarOpen({ name, isOpen: false });
	};

	if (!isOpen) return null;

	const position: 'left' | 'right' = placement === 'end' ? 'right' : 'left';
	const fullScreen = isFullscreen || size === 'full';

	return (
		<MantineDrawer
			opened={isOpen}
			onClose={handleClose}
			position={position}
			size={fullScreen ? '100%' : size ?? 'lg'}
			withOverlay={!contained}
			withinPortal={!contained}
			zIndex={3000}
		>
			<Group justify="space-between" align="center" mb="md" wrap="nowrap">
				<Title order={4} style={{ lineHeight: 1.2 }}>
					{title}
				</Title>
				<Group gap="xs" wrap="nowrap">
					<ActionIcon
						aria-label="Toggle fullscreen"
						variant={isFullscreen ? 'filled' : 'subtle'}
						onClick={() => changeSidebarSettings({ name, settings: { isFullscreen: !isFullscreen } })}
					>
						<LuFullscreen />
					</ActionIcon>
					<ActionIcon
						aria-label="Toggle placement"
						variant="subtle"
						onClick={() =>
							changeSidebarSettings({ name, settings: { placement: placement === 'start' ? 'end' : 'start' } })
						}
					>
						{placement === 'start' ? <LuArrowRightToLine /> : <LuArrowLeftToLine />}
					</ActionIcon>
					<ActionIcon aria-label="Close sidebar" variant="subtle" onClick={handleClose}>
						×
					</ActionIcon>
				</Group>
			</Group>

			{children}
		</MantineDrawer>
	);
};
