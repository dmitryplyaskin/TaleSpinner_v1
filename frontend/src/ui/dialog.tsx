import { Button, Stack } from '@chakra-ui/react';
import * as DialogPrimitive from './chakra-core-ui/dialog';
import { ReactNode } from 'react';

export interface DialogProps {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	size?: 'sm' | 'md' | 'lg' | 'xl' | 'cover';
	footer?: ReactNode;
	showCloseButton?: boolean;
	closeOnInteractOutside?: boolean;
	closeOnEscape?: boolean;
}

export const Dialog: React.FC<DialogProps> = ({
	isOpen,
	onClose,
	title,
	children,
	size = 'md',
	footer,
	showCloseButton = true,
	closeOnInteractOutside,
	closeOnEscape,
}) => {
	if (!isOpen) return null;

	return (
		<DialogPrimitive.DialogRoot
			open={isOpen}
			onOpenChange={onClose}
			size={size}
			closeOnInteractOutside={closeOnInteractOutside}
			closeOnEscape={closeOnEscape}
			scrollBehavior="inside"
			persistentElements={[() => document.querySelector('.chakra-popover__positioner')]}
		>
			<DialogPrimitive.DialogBackdrop />
			<DialogPrimitive.DialogContent maxHeight={'none'}>
				<DialogPrimitive.DialogHeader>
					<DialogPrimitive.DialogTitle>{title}</DialogPrimitive.DialogTitle>
					{showCloseButton && <DialogPrimitive.DialogCloseTrigger onClick={onClose} />}
				</DialogPrimitive.DialogHeader>

				<DialogPrimitive.DialogBody>
					<Stack gap={4}>{children}</Stack>
				</DialogPrimitive.DialogBody>

				<DialogPrimitive.DialogFooter>
					{footer || (
						<>
							<Button variant="ghost" mr={3} onClick={onClose}>
								Отмена
							</Button>
							<Button colorScheme="blue" type="submit" form="dialog-form">
								Сохранить
							</Button>
						</>
					)}
				</DialogPrimitive.DialogFooter>
			</DialogPrimitive.DialogContent>
		</DialogPrimitive.DialogRoot>
	);
};
