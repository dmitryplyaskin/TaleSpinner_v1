import React from 'react';

import { Flex, Button, Stack } from '@chakra-ui/react';
import { LuPlus } from 'react-icons/lu';

import { useUnit } from 'effector-react';
import { $chatList, createChatFx } from '@model/chat-list';

import { CharacterCard } from './chat-card';
import { Drawer } from '@ui/drawer';
import { EditChatModal } from './edit-chat-modal';
import { Upload } from './components/upload';

export const ChatCardSidebar: React.FC = () => {
	const list = useUnit($chatList);
	const createChat = useUnit(createChatFx);

	return (
		<>
			<Drawer name="chatCards" title="Chat cards">
				<Flex direction="column" gap="4">
					<Stack direction="row" gap={4}>
						<Button onClick={() => createChat()} colorScheme="blue">
							<LuPlus /> Создать карточку
						</Button>
						<Upload />
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
