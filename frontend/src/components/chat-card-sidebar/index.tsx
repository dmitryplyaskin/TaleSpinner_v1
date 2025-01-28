import React from 'react';

import { Flex, Button, Stack, FileUploadFileAcceptDetails } from '@chakra-ui/react';
import { LuPlus, LuUpload } from 'react-icons/lu';

import { useUnit } from 'effector-react';
import { $chatList, createChatFx } from '@model/chat-list';
import { uploadFiles, uploadFilesFx } from '@model/files';
import { CharacterCard } from './chat-card';
import { Drawer } from '@ui/drawer';
import { EditChatModal } from './edit-chat-modal';
import { FileUploadRoot, FileUploadTrigger } from '@ui/chakra-core-ui/file-upload';
import { toaster } from '@ui/chakra-core-ui/toaster';

export const ChatCardSidebar: React.FC = () => {
	const list = useUnit($chatList);
	const createChat = useUnit(createChatFx);
	const uploadFilesFn = useUnit(uploadFiles);

	const handleFileChange = async (details: FileUploadFileAcceptDetails) => {
		if (!details.files?.length) return;

		try {
			await uploadFilesFn(Array.from(details.files));
			toaster.success({
				title: 'Успешно',
				description: 'Файлы успешно загружены',
			});
		} catch (error) {
			toaster.error({ title: 'Не удалось загрузить файлы' });
		}
	};

	return (
		<>
			<Drawer name="chatCards" title="Chat cards">
				<Flex direction="column" gap="4">
					<Stack direction="row" gap={4}>
						<Button onClick={() => createChat()} colorScheme="blue">
							<LuPlus /> Создать карточку
						</Button>
						<FileUploadRoot
							maxFiles={10}
							onFileAccept={handleFileChange}
							accept={{
								'image/png': ['.png'],
								'application/json': ['.json'],
							}}
						>
							<FileUploadTrigger asChild>
								<Button colorScheme="green">
									<LuUpload /> Импорт
								</Button>
							</FileUploadTrigger>
						</FileUploadRoot>
					</Stack>
					{list.map((chat) => (
						<CharacterCard key={chat.id} data={chat} />
					))}
				</Flex>
			</Drawer>
			<EditChatModal />
		</>
	);
};
