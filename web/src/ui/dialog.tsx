import { Button, Group, Modal, Stack } from '@mantine/core';
import { useTranslation } from 'react-i18next';

import { getFullscreenSidebarPresentation } from './drawer-presentation';
import { Z_INDEX } from './z-index';

import type { ReactNode } from 'react';

export interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: ReactNode;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'cover' | number;
	footer?: ReactNode;
	showCloseButton?: boolean;
	closeOnInteractOutside?: boolean;
	closeOnEscape?: boolean;
	zIndex?: number;
	fullScreenContentMaxWidth?: number;
	fillBodyHeight?: boolean;
}

export const Dialog = ({
	open,
	onOpenChange,
	title,
	children,
	size = 'md',
	footer,
	showCloseButton = true,
	closeOnInteractOutside,
	closeOnEscape,
	zIndex,
	fullScreenContentMaxWidth,
	fillBodyHeight = false,
}: DialogProps) => {
	const { t } = useTranslation();
	if (!open) return null;

	const fullScreen = size === 'cover';
	const modalSize = fullScreen ? '100%' : size;
	const drawerLikeFullscreen = fullScreen && typeof fullScreenContentMaxWidth === 'number';
	const fullscreenPresentation = drawerLikeFullscreen
		? getFullscreenSidebarPresentation(fullScreenContentMaxWidth)
		: null;
	const content = (
		<div
			style={
				fillBodyHeight
					? {
							display: 'flex',
							flexDirection: 'column',
							height: '100%',
							minHeight: 0,
						}
					: undefined
			}
		>
			<Stack gap="md" style={fillBodyHeight ? { flex: 1, minHeight: 0 } : undefined}>
				{children}
			</Stack>

			{footer ? (
				<Group justify="flex-end" mt="md">
					{footer}
				</Group>
			) : (
				<Group justify="flex-end" mt="md">
					<Button variant="subtle" onClick={() => onOpenChange(false)}>
						{t('common.cancel')}
					</Button>
					<Button type="submit" form="dialog-form">
						{t('common.save')}
					</Button>
				</Group>
			)}
		</div>
	);

	return (
		<Modal
			opened={open}
			onClose={() => onOpenChange(false)}
			title={drawerLikeFullscreen ? undefined : title}
			size={modalSize}
			fullScreen={fullScreen}
			withCloseButton={drawerLikeFullscreen ? false : showCloseButton}
			closeButtonProps={{ 'aria-label': t('common.close') }}
			closeOnClickOutside={closeOnInteractOutside ?? true}
			closeOnEscape={closeOnEscape ?? true}
			zIndex={zIndex ?? Z_INDEX.overlay.modal}
			withinPortal
			padding={drawerLikeFullscreen ? 0 : undefined}
			classNames={
				drawerLikeFullscreen
					? {
							content: 'ts-sidebar-modal-content',
							body: 'ts-sidebar-modal-body',
						}
					: undefined
			}
		>
			{drawerLikeFullscreen ? (
				<div className={`${fullscreenPresentation?.frameClassName ?? ''} ts-scrollbar-thin`}>
					<div className={fullscreenPresentation?.containerClassName} style={fullscreenPresentation?.containerStyle}>
						{content}
					</div>
				</div>
			) : (
				content
			)}
		</Modal>
	);
};
