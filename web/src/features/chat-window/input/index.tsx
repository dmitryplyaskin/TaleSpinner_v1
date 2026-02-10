import { Box, Button, Flex, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { $isChatStreaming, abortRequested, sendMessageRequested } from '@model/chat-entry-parts';
import { $userMessage, clearUserMessage, setUserMessage } from '@model/llm-orchestration/user-message';

import { ChatManagementMenu } from './chat-management-menu';
import { SendActionMenu } from './send-action-menu';

import type { ChangeEvent, KeyboardEvent } from 'react';

export const MessageInput = () => {
	const { t } = useTranslation();
	const isProcessing = useUnit($isChatStreaming);
	const message = useUnit($userMessage);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setUserMessage(event.target.value);
	};

	const handleSendMessage = () => {
		if (isProcessing) {
			abortRequested();
			return;
		}
		sendMessageRequested({ promptText: message, role: 'user' });
		clearUserMessage();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<Box w="100%" className="ts-chat-input">
			<Flex direction="column" gap="sm" w="100%">
				<Textarea
					ref={textareaRef}
					value={message}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					placeholder={t('chat.input.placeholder')}
					disabled={isProcessing}
					autosize
					minRows={1}
					maxRows={6}
					radius="md"
					size="md"
					w="100%"
					styles={{
						input: {
							overflow: 'hidden',
							backgroundColor: 'transparent',
						},
					}}
				/>
				<Flex justify="space-between" align="center">
					<ChatManagementMenu />
					<Flex gap="xs">
						<SendActionMenu />
						<Button onClick={handleSendMessage} color={isProcessing ? 'red' : 'cyan'} style={{ whiteSpace: 'nowrap' }}>
							{isProcessing ? t('chat.input.abort') : t('chat.input.send')}
						</Button>
					</Flex>
				</Flex>
			</Flex>
		</Box>
	);
};
