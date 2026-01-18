import { Stack } from '@mantine/core';
import { useList } from 'effector-react';

import { $currentChat } from '@model/chat-service';

import { Message } from './message';

export const RenderChat = () => {
	const messages = useList($currentChat, (message) => <Message key={message.id} data={message} />);

	if (!messages) return null;

	return (
		<Stack gap="md">
			{messages}
		</Stack>
	);
};
