import { Button, Input, Stack } from '@chakra-ui/react';
import { ChatCard } from '../../types/chat';
import * as Dialog from '@ui/chakra-core-ui/dialog';
import { useState } from 'react';
import { saveChatFx } from '@model/chat-list';
import { Field } from '@ui/chakra-core-ui/field';

type Props = {
	isOpen: boolean;
	onClose: () => void;
	chat: ChatCard;
};

export const EditChatModal: React.FC<Props> = ({ isOpen, onClose, chat }) => {
	const [title, setTitle] = useState(chat.title);
	const [imagePath, setImagePath] = useState(chat.imagePath);

	const handleSave = async () => {
		await saveChatFx({ ...chat, title, imagePath });
		onClose();
	};

	if (!isOpen) return null;

	return (
		<Dialog.DialogRoot open={isOpen} onOpenChange={() => onClose()} size={'cover'}>
			<Dialog.DialogBackdrop />
			<Dialog.DialogContent>
				<Dialog.DialogHeader>
					<Dialog.DialogTitle>Редактировать чат</Dialog.DialogTitle>
					<Dialog.DialogCloseTrigger onClick={onClose} />
				</Dialog.DialogHeader>
				<Dialog.DialogBody>
					<Stack gap={3}>
						<Field label="Название">
							<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Введите название" />
						</Field>
						<Field label="Путь к изображению">
							<Input
								value={imagePath}
								onChange={(e) => setImagePath(e.target.value)}
								placeholder="Введите URL изображения"
							/>
						</Field>
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
	);
};
