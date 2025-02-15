import React from 'react';
import { Flex, Textarea, Button, Box, Container } from '@chakra-ui/react';
import { useUnit } from 'effector-react';
import { $userMessage, setUserMessage } from '@model/llm-orchestration/user-message';
import { $isCompletionsProcessing, attachCompletionsFx } from '@model/llm-orchestration';

interface MessageInputProps {}

export const MessageInput: React.FC<MessageInputProps> = ({}) => {
	const isProcessing = useUnit($isCompletionsProcessing);
	const message = useUnit($userMessage);

	const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setUserMessage(event.target.value);
	};

	const handleSendMessage = () => {
		attachCompletionsFx({});
	};

	const handleKeyPress = (event: React.KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<Box p={4} bg="white" borderTop="1px" borderColor="gray.200" shadow="md">
			<Container maxW="6xl">
				<Flex gap={4}>
					<Textarea
						value={message}
						onChange={handleInputChange}
						onKeyPress={handleKeyPress}
						placeholder="Введите сообщение..."
						autoresize
						disabled={isProcessing}
						flex="1"
						size={'lg'}
						borderRadius="lg"
						resize={'vertical'}
					/>
					<Button onClick={handleSendMessage} colorScheme={isProcessing ? 'red' : 'blue'} whiteSpace="nowrap">
						{isProcessing ? 'Оборвать' : 'Отправить'}
					</Button>
				</Flex>{' '}
			</Container>
		</Box>
	);
};
