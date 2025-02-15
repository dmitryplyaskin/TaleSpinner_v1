import React, { useState, useRef } from 'react';

import { RenderChat } from './render-chat';

import { Flex, Box, Container } from '@chakra-ui/react';

import { $currentAgentCard, addNewAssistantMessage, addNewUserMessage, updateSwipeStream } from '@model/chat-service';
import { createNewMessage } from '../../utils/creation-helper-agent-card';
import { buildMessages } from '../../utils/build-messages';
import { generate, streamController } from '@model/llm-orchestration';
import { MessageInput } from './message-input';

export const ChatWindow: React.FC = () => {
	const [isStreaming, setIsStreaming] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [steamId, setStreamId] = useState('');

	const handleSendMessage = async () => {
		if (isStreaming) {
			streamController.abortStream(steamId);
			return;
		}

		const userMessage = createNewMessage({ role: 'user', content: text });
		addNewUserMessage(userMessage.message);

		setIsStreaming(true);

		try {
			const messages = buildMessages($currentAgentCard.getState()!);

			const assistantMessage = createNewMessage({ role: 'assistant', content: '' });
			addNewAssistantMessage(assistantMessage.message);

			const streamId_ = streamController.createStream();
			setStreamId(streamId_);

			await generate({
				llmSettings: undefined,
				messages,
				stream: true,
				streamId: streamId_,
				streamCb: ({ chunk }) => {
					updateSwipeStream({
						messageId: assistantMessage.messageId,
						swipeId: assistantMessage.swipeId,
						componentId: assistantMessage.contentId,
						content: chunk,
					});
				},
			});

			setIsStreaming(false);

			// if (messagesEndRef.current) {
			// 	if (messagesEndRef.current.scrollHeight > messagesEndRef.current.clientHeight) {
			// 		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
			// 	}
			// }
		} catch (error) {
			console.error('Error:', error);
		} finally {
			setIsStreaming(false);
		}
	};

	return (
		<Flex direction="column" h="full">
			<Box flex="1" overflowY="auto" bg="gray.100">
				<Container maxW="6xl" p={4}>
					<RenderChat />
					<div ref={messagesEndRef} />
				</Container>
			</Box>

			<MessageInput />
		</Flex>
	);
};
