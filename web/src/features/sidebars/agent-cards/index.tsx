import { Box, Button, Flex, HStack } from '@chakra-ui/react';
import { useUnit } from 'effector-react';
import React from 'react';
import { LuPlus } from 'react-icons/lu';

import { agentCardsModel } from '@model/agent-cards';
import { Drawer } from '@ui/drawer';
import { createNewAgentCard } from '@utils/creation-helper-agent-card';

import { Pagination } from '../common/pagination';

import { AgentCard } from './agent-card';
import { Upload } from './components/upload';
import { EditChatModal } from './edit-chat-modal';
import { ChatListSortFilterControls } from './sort-filter-controls';

export const AgentCardsSidebar: React.FC = () => {
	const list = useUnit(agentCardsModel.paginationWithSortFilter.$paginatedItems);

	return (
		<>
			<Drawer name="agentCards" title="Agent cards">
				<Flex direction="column" gap="4">
					<HStack gap={4}>
						<Button onClick={() => agentCardsModel.createItemFx(createNewAgentCard())} colorPalette="blue">
							<LuPlus /> Создать карточку
						</Button>
						<Upload />
					</HStack>
					<Box>
						<ChatListSortFilterControls />
					</Box>

					{list.map((chat) => (
						<AgentCard key={chat.id} data={chat} />
					))}
					<Pagination model={agentCardsModel} />
				</Flex>
			</Drawer>
			<EditChatModal />
		</>
	);
};
