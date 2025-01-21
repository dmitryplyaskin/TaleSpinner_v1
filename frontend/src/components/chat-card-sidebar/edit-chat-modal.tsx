import { Stack } from '@chakra-ui/react';
import { ChatCard } from '../../types/chat';
import { Dialog } from '@ui/dialog';
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

	const handleSubmit = form.handleSubmit(async (data) => {
		// Здесь будет логика сохранения
		onClose();
	});

	if (!isOpen) return null;

	return (
		<FormProvider {...form}>
			<form id="dialog-form" onSubmit={handleSubmit}>
				<Dialog isOpen={isOpen} onClose={onClose} title="Редактировать чат" size="cover">
					<Stack gap={3}>
						<FormInput name="title" label="Название" placeholder="Введите название" />
						<FormInput name="imagePath" label="Путь к изображению" placeholder="Введите URL изображения" />
					</Stack>
				</Dialog>
			</form>
		</FormProvider>
	);
};
