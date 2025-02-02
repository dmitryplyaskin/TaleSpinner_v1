import React, { useState, useRef } from 'react';
import { streamMessage } from '../api';
import { RenderChat } from './render-chat';

import { Flex, Box, Button, Container, Textarea } from '@chakra-ui/react';

import {
	$currentAgentCard,
	addNewAssistantMessage,
	addNewUserMessage,
	updateSwipe,
	updateSwipeStream,
} from '@model/chat-service';
import { createNewMessage } from '../../utils/creation-helper-agent-card';
import { buildMessages } from '../../utils/build-messages';

interface ChatWindowProps {
	llmSettings: {
		temperature: number;
		maxTokens: number;
		topP: number;
		frequencyPenalty: number;
		presencePenalty: number;
	};
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ llmSettings }) => {
	const [text, setText] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setText(event.target.value);
	};

	const handleSendMessage = async () => {
		if (text.trim() === '' || isStreaming) return;

		const userMessage = createNewMessage({ role: 'user', content: text });
		addNewUserMessage(userMessage.message);

		const assistantMessage = createNewMessage({ role: 'assistant', content: 'processing...' });
		addNewAssistantMessage(assistantMessage.message);

		setText('');
		setIsStreaming(true);

		try {
			const messages = buildMessages($currentAgentCard.getState()!);

			const messageStream = streamMessage({
				messages,
				settings: llmSettings,
			});

			let isFirstChunk = true;

			for await (const chunk of messageStream) {
				if ('error' in chunk) {
					break;
				}

				if (isFirstChunk) {
					updateSwipe({
						messageId: assistantMessage.messageId,
						swipeId: assistantMessage.swipeId,
						componentId: assistantMessage.contentId,
						content: '',
					});

					isFirstChunk = false;
				}

				updateSwipeStream({
					messageId: assistantMessage.messageId,
					swipeId: assistantMessage.swipeId,
					componentId: assistantMessage.contentId,
					content: chunk.content,
				});

				// if (messagesEndRef.current) {
				// 	if (messagesEndRef.current.scrollHeight > messagesEndRef.current.clientHeight) {
				// 		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
				// 	}
				// }
			}
		} catch (error) {
			console.error('Error:', error);
		} finally {
			setIsStreaming(false);
		}
	};

	const handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
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

			<Box p={4} bg="white" borderTop="1px" borderColor="gray.200" shadow="md">
				<Container maxW="6xl">
					<Flex gap={4}>
						<Textarea
							value={text}
							onChange={handleInputChange}
							onKeyPress={handleKeyPress}
							placeholder="Введите сообщение..."
							autoresize
							disabled={isStreaming}
							flex="1"
							size={'lg'}
							borderRadius="lg"
							resize={'vertical'}
						/>
						<Button
							onClick={handleSendMessage}
							disabled={isStreaming || !text.trim()}
							colorScheme={isStreaming || !text.trim() ? 'gray' : 'blue'}
							whiteSpace="nowrap"
						>
							{isStreaming ? 'Отправка...' : 'Отправить'}
						</Button>
					</Flex>
				</Container>
			</Box>
		</Flex>
	);
};
