import { Stack } from '@mantine/core';
import { useList } from 'effector-react';

import { $messages } from '@model/chat-core';

import { Message } from './message';

export const RenderChat = () => {
	const messages = useList($messages, (message) => <Message key={message.id} data={message} />);

	if (!messages) return null;

	return (
		<Stack gap="md">
			{messages}
		</Stack>
	);
};
