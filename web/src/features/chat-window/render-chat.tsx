import { Stack } from '@mantine/core';
import { useUnit } from 'effector-react';

import { $entries } from '@model/chat-entry-parts';

import { Message } from './message';

export const RenderChat = () => {
	const entries = useUnit($entries);

	if (!entries) return null;

	return (
		<Stack gap="md">
			{entries.map((entry, index) => (
				<Message key={entry.entry.entryId} data={entry} isLast={index === entries.length - 1} />
			))}
		</Stack>
	);
};
