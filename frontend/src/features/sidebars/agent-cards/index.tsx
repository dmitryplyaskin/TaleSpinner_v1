import React, { useEffect } from 'react';

import { Flex, Button, Stack, Box } from '@chakra-ui/react';
import { LuPlus } from 'react-icons/lu';

import { useUnit } from 'effector-react';
import { chatListModel } from '@model/chat-list';

import { AgentCard } from './agent-card';
import { Drawer } from '@ui/drawer';
import { EditChatModal } from './edit-chat-modal';
import { Upload } from './components/upload';
import { createNewAgentCard } from '@utils/creation-helper-agent-card';
import { Pagination } from '../common/pagination';
import { ChatListSortFilterControls } from './sort-filter-controls';

export const AgentCardsSidebar: React.FC = () => {
	const list = useUnit(chatListModel.paginationWithSortFilter.$paginatedItems);

	useEffect(() => {
		chatListModel.getItemsFx();
	}, []);

	return (
		<>
			<Drawer name="agentCards" title="Agent cards">
				<Flex direction="column" gap="4">
					<Stack direction="row" gap={4}>
						<Button onClick={() => chatListModel.createItemFx(createNewAgentCard())} colorScheme="blue">
							<LuPlus /> Создать карточку
						</Button>
						<Upload />
					</Stack>
					<Box>
						<ChatListSortFilterControls />
					</Box>

					{list.map((chat) => (
						<AgentCard key={chat.id} data={chat} />
					))}
					<Pagination model={chatListModel} />
				</Flex>
			</Drawer>
			<EditChatModal />
		</>
	);
};
