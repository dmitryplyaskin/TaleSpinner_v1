import { Stack } from '@mantine/core';
import { useUnit } from 'effector-react';

import { $messages } from '@model/chat-core';

import { Message } from './message';

export const RenderChat = () => {
	const messages = useUnit($messages);

	if (!messages) return null;

	return (
		<Stack gap="md">
			{messages.map((message, index) => (
				<Message key={message.id} data={message} isLast={index === messages.length - 1} />
			))}
		</Stack>
	);
};
