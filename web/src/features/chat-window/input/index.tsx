import { Box, Button, Flex, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useRef } from 'react';

import { $isCompletionsProcessing, attachCompletionsFx } from '@model/llm-orchestration';
import { $userMessage, setUserMessage } from '@model/llm-orchestration/user-message';

import { SendActionMenu } from './send-action-menu';

import type { ChangeEvent, KeyboardEvent } from 'react';

export const MessageInput = () => {
	const isProcessing = useUnit($isCompletionsProcessing);
	const message = useUnit($userMessage);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setUserMessage(event.target.value);
	};

	const handleSendMessage = () => {
		attachCompletionsFx('new-message');
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<Box w="100%" bg="white" p="md" style={{ borderTop: '1px solid var(--mantine-color-gray-3)' }}>
			<Flex direction="column" gap="md" w="100%">
				<Textarea
					ref={textareaRef}
					value={message}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					placeholder="Введите сообщение..."
					disabled={isProcessing}
					autosize
					minRows={1}
					maxRows={6}
					radius="md"
					size="md"
					styles={{
						input: {
							overflow: 'hidden',
						},
					}}
				/>
				<Flex justify="flex-end">
					<Flex gap="xs">
						<SendActionMenu />
						<Button onClick={handleSendMessage} color={isProcessing ? 'red' : 'blue'} style={{ whiteSpace: 'nowrap' }}>
							{isProcessing ? 'Оборвать' : 'Отправить'}
						</Button>
					</Flex>
				</Flex>
			</Flex>
		</Box>
	);
};
