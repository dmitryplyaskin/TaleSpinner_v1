import { VStack } from '@chakra-ui/react';
import { useList } from 'effector-react';

import { $currentChat } from '@model/chat-service';

import { Message } from './message';

export const RenderChat = () => {
	const messages = useList($currentChat, (message) => <Message key={message.id} data={message} />);

	if (!messages) return null;

	return (
		<VStack gap={4} align="stretch">
			{messages}
		</VStack>
	);
};
