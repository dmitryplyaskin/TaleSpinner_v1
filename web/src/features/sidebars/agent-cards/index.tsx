import { Box, Button, Group, Stack } from '@mantine/core';
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
				<Stack gap="md">
					<Group gap="md">
						<Button onClick={() => agentCardsModel.createItemFx(createNewAgentCard())} leftSection={<LuPlus />}>
							Создать карточку
						</Button>
						<Upload />
					</Group>
					<Box>
						<ChatListSortFilterControls />
					</Box>

					{list.map((chat) => (
						<AgentCard key={chat.id} data={chat} />
					))}
					<Pagination model={agentCardsModel} />
				</Stack>
			</Drawer>
			<EditChatModal />
		</>
	);
};
