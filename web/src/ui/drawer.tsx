import { Box, Modal } from '@mantine/core';
import { useStoreMap } from 'effector-react';
import { useTranslation } from 'react-i18next';

import { $sidebars, changeSidebarSettings, type SidebarName, toggleSidebarOpen } from '@model/sidebars';
import { Z_INDEX } from '@ui/z-index';

import { getDrawerPresentation } from './drawer-presentation';
import { SidebarShell } from './sidebar-shell';

import type { ReactNode } from 'react';

type Props = {
	name: SidebarName;
	title: string;
	children: ReactNode;
	defaultSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
	defaultPlacement?: 'start' | 'end' | 'top' | 'bottom';
	contained?: boolean;
	fullscreenContentMaxWidth?: number;
	fixedSize?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
};

const drawerWidthBySize: Record<'xs' | 'sm' | 'md' | 'lg' | 'xl', number> = {
	xs: 340,
	sm: 400,
	md: 480,
	lg: 560,
	xl: 640,
};

export const Drawer = ({
	name,
	title,
	children,
	fullscreenContentMaxWidth = 1440,
	fixedSize,
	defaultSize = 'lg',
}: Props) => {
	const { t } = useTranslation();
	const sidebar = useStoreMap({
		store: $sidebars,
		keys: [name],
		fn: (sidebars, [key]) => sidebars[key],
	});

	const { isOpen, isFullscreen, placement, size, contained } = sidebar;
	const resolvedSize = fixedSize ?? size ?? defaultSize;
	const fullScreen = isFullscreen || resolvedSize === 'full';
	const drawerWidth = resolvedSize === 'full' ? '100%' : drawerWidthBySize[resolvedSize];
	const presentation = getDrawerPresentation({
		drawerWidth,
		fullScreen,
		fullscreenContentMaxWidth,
		placement,
	});

	const handleClose = () => {
		toggleSidebarOpen({ name, isOpen: false });
	};

	const handleToggleFullscreen = () => {
		const nextFullscreen = !fullScreen;
		const fallbackSize = fixedSize ?? defaultSize;
		changeSidebarSettings({
			name,
			settings: nextFullscreen
				? { isFullscreen: true }
				: { isFullscreen: false, ...(resolvedSize === 'full' ? { size: fallbackSize } : {}) },
		});
	};

	if (!isOpen) return null;
	const shell = (
		<SidebarShell
			title={title}
			isFullscreen={fullScreen}
			placement={placement}
			onClose={handleClose}
			onToggleFullscreen={handleToggleFullscreen}
			onTogglePlacement={() =>
				changeSidebarSettings({ name, settings: { placement: placement === 'start' ? 'end' : 'start' } })
			}
			contentClassName={presentation.shellContentClassName}
			labels={{
				toggleFullscreen: fullScreen ? t('drawer.exitFullscreen') : t('drawer.enterFullscreen'),
				togglePlacement: placement === 'start' ? t('drawer.moveToEnd') : t('drawer.moveToStart'),
				close: t('drawer.close'),
			}}
		>
			{children}
		</SidebarShell>
	);

	return (
		<Modal
			opened={isOpen}
			onClose={handleClose}
			fullScreen
			withinPortal={!contained}
			withCloseButton={false}
			padding={0}
			withOverlay={!contained && presentation.withOverlay}
			trapFocus={fullScreen}
			lockScroll={fullScreen}
			closeOnClickOutside={fullScreen}
			zIndex={Z_INDEX.overlay.drawer}
			classNames={{
				content: presentation.modalContentClassName,
				body: presentation.modalBodyClassName,
			}}
		>
			<Box className={`${presentation.frameClassName} ts-scrollbar-thin`}>
				<Box className={presentation.containerClassName} style={presentation.containerStyle}>
					{shell}
				</Box>
			</Box>
		</Modal>
	);
};
