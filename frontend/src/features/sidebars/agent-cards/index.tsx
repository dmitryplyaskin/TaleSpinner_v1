import React, { useEffect } from 'react';

import { Flex, Button, Stack } from '@chakra-ui/react';
import { LuPlus } from 'react-icons/lu';

import { useUnit } from 'effector-react';
import { chatListModel } from '@model/chat-list';

import { AgentCard } from './agent-card';
import { Drawer } from '@ui/drawer';
import { EditChatModal } from './edit-chat-modal';
import { Upload } from './components/upload';
import { createNewAgentCard } from '@utils/creation-helper-agent-card';

export const AgentCardsSidebar: React.FC = () => {
	const list = useUnit(chatListModel.$items);

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

					{list.map((chat) => (
						<AgentCard key={chat.id} data={chat} />
					))}
				</Flex>
			</Drawer>
			<EditChatModal />
		</>
	);
};
