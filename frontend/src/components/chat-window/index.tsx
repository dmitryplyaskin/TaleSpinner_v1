import React, { useState, useEffect, useRef } from 'react';
import { streamMessage, ChatMessage } from '../api';
import { RenderChat } from './render-chat';
import { v4 as uuidv4 } from 'uuid';
import { $currentChatFormatted } from '../../model';
import { useUnit } from 'effector-react';
import { Flex, Box, Button, Container, Textarea } from '@chakra-ui/react';

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
	const chat = useUnit($currentChatFormatted);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [newMessage, setNewMessage] = useState('');
	const [isStreaming, setIsStreaming] = useState(false);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setNewMessage(event.target.value);
	};

	const handleSendMessage = async () => {
		if (newMessage.trim() === '' || isStreaming) return;

		const messagesList = chat?.chatHistories.find(
			(chatHistory) => chatHistory.id === chat?.activeChatHistoryId,
		)?.messages;

		if (messagesList) {
			messagesList.push({
				id: uuidv4(),
				role: 'user',
				content: newMessage,
				timestamp: new Date().toISOString(),
			});
		}

		setNewMessage('');
		setIsStreaming(true);

		try {
			const messageStream = streamMessage(messagesList, chat, llmSettings);
			let botMessage: ChatMessage = {
				role: 'bot',
				content: '',
				timestamp: new Date().toISOString(),
			};

			let isFirstChunk = true;

			for await (const chunk of messageStream) {
				if ('error' in chunk) {
					break;
				}
				console.log(chunk);

				if (isFirstChunk) {
					setMessages((prev) => [...prev, botMessage]);
					isFirstChunk = false;
				}

				botMessage.content += chunk.content;
				setMessages((prev) => {
					const newMessages = [...prev];
					const lastMessage = newMessages[newMessages.length - 1];
					if (lastMessage.role === 'bot') {
						lastMessage.content = botMessage.content;
					}
					return newMessages;
				});
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

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	};

	useEffect(scrollToBottom, [messages]);

	return (
		<Flex direction="column" h="full">
			<Box flex="1" overflowY="auto" bg="gray.100">
				<Container maxW="6xl" p={4}>
					<RenderChat chatCard={chat} />
					<div ref={messagesEndRef} />
				</Container>
			</Box>

			<Box p={4} bg="white" borderTop="1px" borderColor="gray.200" shadow="md">
				<Container maxW="6xl">
					<Flex gap={4}>
						<Textarea
							value={newMessage}
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
							disabled={isStreaming || !newMessage.trim()}
							colorScheme={isStreaming || !newMessage.trim() ? 'gray' : 'blue'}
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
