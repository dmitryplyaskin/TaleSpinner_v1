import { Button, Stack } from '@chakra-ui/react';
import { ChatCard } from '../../types/chat';
import * as Dialog from '@ui/chakra-core-ui/dialog';
import { FormProvider, useForm } from 'react-hook-form';
import { FormInput } from '@ui/form-components';

type Props = {
	isOpen: boolean;
	onClose: () => void;
	chat: ChatCard;
};

export const EditChatModal: React.FC<Props> = ({ isOpen, onClose, chat }) => {
	const form = useForm({
		defaultValues: {
			title: chat.title,
			imagePath: chat.imagePath,
		},
	});

	const handleSave = async () => {
		onClose();
	};

	if (!isOpen) return null;

	return (
		<FormProvider {...form}>
			<Dialog.DialogRoot open={isOpen} onOpenChange={() => onClose()} size={'cover'}>
				<Dialog.DialogBackdrop />
				<Dialog.DialogContent>
					<Dialog.DialogHeader>
						<Dialog.DialogTitle>Редактировать чат</Dialog.DialogTitle>
						<Dialog.DialogCloseTrigger onClick={onClose} />
					</Dialog.DialogHeader>
					<Dialog.DialogBody>
						<Stack gap={3}>
							<FormInput name="title" label="Название" placeholder="Введите название" />
							<FormInput name="imagePath" label="Путь к изображению" placeholder="Введите URL изображения" />
						</Stack>
					</Dialog.DialogBody>
					<Dialog.DialogFooter>
						<Button variant="ghost" mr={3} onClick={onClose}>
							Отмена
						</Button>
						<Button colorScheme="blue" onClick={handleSave}>
							Сохранить
						</Button>
					</Dialog.DialogFooter>
				</Dialog.DialogContent>
			</Dialog.DialogRoot>
		</FormProvider>
	);
};
