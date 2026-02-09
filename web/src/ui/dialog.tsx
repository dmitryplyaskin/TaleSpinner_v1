import { Button, Group, Modal, Stack } from '@mantine/core';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

export interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	children: ReactNode;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'cover';
	footer?: ReactNode;
	showCloseButton?: boolean;
	closeOnInteractOutside?: boolean;
	closeOnEscape?: boolean;
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
}: DialogProps) => {
	const { t } = useTranslation();
	if (!open) return null;

	const fullScreen = size === 'cover';
	const modalSize = fullScreen ? '100%' : size;

	return (
		<Modal
			opened={open}
			onClose={() => onOpenChange(false)}
			title={title}
			size={modalSize}
			fullScreen={fullScreen}
			withCloseButton={showCloseButton}
			closeOnClickOutside={closeOnInteractOutside ?? true}
			closeOnEscape={closeOnEscape ?? true}
			zIndex={3200}
			withinPortal
		>
			<Stack gap="md">{children}</Stack>

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
		</Modal>
	);
};
