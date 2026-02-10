import { Box, Button, Flex, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import {
	$entries,
	$isBulkDeleteMode,
	$isChatStreaming,
	abortRequested,
	continueFromLastUserRequested,
	sendMessageRequested,
} from '@model/chat-entry-parts';
import { $userMessage, clearUserMessage, setUserMessage } from '@model/llm-orchestration/user-message';

import { ChatManagementMenu } from './chat-management-menu';
import { SendActionMenu } from './send-action-menu';

import type { ChangeEvent, KeyboardEvent } from 'react';

export const MessageInput = () => {
	const { t } = useTranslation();
	const [isProcessing, entries, isBulkDeleteMode] = useUnit([$isChatStreaming, $entries, $isBulkDeleteMode]);
	const message = useUnit($userMessage);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const trimmedMessage = message.trim();
	const lastEntry = entries[entries.length - 1];
	const canContinueFromLastUser = !isProcessing && !isBulkDeleteMode && trimmedMessage.length === 0 && lastEntry?.entry.role === 'user';

	const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setUserMessage(event.target.value);
	};

	const handleSendMessage = () => {
		if (isProcessing) {
			abortRequested();
			return;
		}
		if (isBulkDeleteMode) return;
		if (trimmedMessage.length > 0) {
			sendMessageRequested({ promptText: message, role: 'user' });
			clearUserMessage();
			return;
		}
		if (canContinueFromLastUser) {
			continueFromLastUserRequested();
		}
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
					placeholder={isBulkDeleteMode ? t('chat.input.bulkDeleteModePlaceholder') : t('chat.input.placeholder')}
					disabled={isProcessing || isBulkDeleteMode}
					autosize
					minRows={1}
					maxRows={6}
					radius="md"
					size="md"
					w="100%"
					styles={{
						input: {
							overflow: 'hidden',
							backgroundColor: 'var(--ts-input-bg)',
						},
					}}
				/>
				<Flex justify="space-between" align="center">
					<ChatManagementMenu />
					<Flex gap="xs">
						{!isBulkDeleteMode && <SendActionMenu />}
						<Button
							onClick={handleSendMessage}
							color={isProcessing ? 'red' : 'cyan'}
							style={{ whiteSpace: 'nowrap' }}
							disabled={isBulkDeleteMode}
						>
							{isProcessing ? t('chat.input.abort') : canContinueFromLastUser ? t('chat.input.continue') : t('chat.input.send')}
						</Button>
					</Flex>
				</Flex>
			</Flex>
		</Box>
	);
};
