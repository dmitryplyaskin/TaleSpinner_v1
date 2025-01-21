import React from 'react';

import { Flex } from '@chakra-ui/react';

import { useUnit } from 'effector-react';
import { $chatList } from '@model/chat-list';
import { CharacterCard } from './chat-card';
import { Drawer } from '@ui/drawer';

export const ChatCardSidebar: React.FC = () => {
	const list = useUnit($chatList);

	if (!list.length) return null;

	return (
		<Drawer name="chatCards" title="Chat cards">
			<Flex direction="column" gap="4">
				<CharacterCard data={list[0]} />
			</Flex>
		</Drawer>
	);
	// return (
	// 	<Drawer name="chatCards" title="Chat cards">
	// 		<Flex direction="column" gap="4">
	// 			{list.map((chat) => (
	// 				<CharacterCard key={chat.id} data={chat} />
	// 			))}
	// 		</Flex>
	// 	</Drawer>
	// );
};
