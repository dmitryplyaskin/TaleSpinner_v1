import { Button, VStack } from '@chakra-ui/react';
import { type ReactNode } from 'react';

import * as DialogPrimitive from './chakra-core-ui/dialog';

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

export const Dialog: React.FC<DialogProps> = ({
	open,
	onOpenChange,
	title,
	children,
	size = 'md',
	footer,
	showCloseButton = true,
	closeOnInteractOutside,
	closeOnEscape,
}) => {
	if (!open) return null;

	return (
		<DialogPrimitive.DialogRoot
			open={open}
			onOpenChange={({ open }) => onOpenChange(open)}
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
					{showCloseButton && <DialogPrimitive.DialogCloseTrigger onClick={() => onOpenChange(false)} />}
				</DialogPrimitive.DialogHeader>

				<DialogPrimitive.DialogBody>
					<VStack gap={4} align="stretch">
						{children}
					</VStack>
				</DialogPrimitive.DialogBody>

				<DialogPrimitive.DialogFooter>
					{footer || (
						<>
							<Button variant="ghost" mr={3} onClick={() => onOpenChange(false)}>
								Отмена
							</Button>
							<Button colorPalette="blue" type="submit" form="dialog-form">
								Сохранить
							</Button>
						</>
					)}
				</DialogPrimitive.DialogFooter>
			</DialogPrimitive.DialogContent>
		</DialogPrimitive.DialogRoot>
	);
};
