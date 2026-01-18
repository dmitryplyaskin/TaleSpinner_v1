import { Box, Button, Flex, Textarea } from '@chakra-ui/react';
import { useUnit } from 'effector-react';
import { useRef } from 'react';

import { $isCompletionsProcessing, attachCompletionsFx } from '@model/llm-orchestration';
import { $userMessage, setUserMessage } from '@model/llm-orchestration/user-message';

import { SendActionMenu } from './send-action-menu';
import { useAutosizeTextarea } from './use-autosize-textarea';

import type { ChangeEvent, KeyboardEvent } from 'react';

export const MessageInput = () => {
	const isProcessing = useUnit($isCompletionsProcessing);
	const message = useUnit($userMessage);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	useAutosizeTextarea({
		value: message,
		textareaRef,
		minRows: 1,
		maxRows: 6,
	});

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
		<Box w="full" bg="white" borderTopWidth="1px" borderTopColor="gray.200" p={4}>
			<Flex gap={3} flexDirection="column" w="full" maxW="full">
				<Textarea
					ref={textareaRef}
					value={message}
					onChange={handleInputChange}
					onKeyDown={handleKeyDown}
					placeholder="Введите сообщение..."
					disabled={isProcessing}
					rows={1}
					size="lg"
					borderRadius="lg"
					resize="none"
					overflow="hidden"
					backgroundColor="white"
				/>
				<Flex justify="flex-end">
					<Flex gap={2}>
						<SendActionMenu />
							<Button onClick={handleSendMessage} colorPalette={isProcessing ? 'red' : 'blue'} whiteSpace="nowrap">
							{isProcessing ? 'Оборвать' : 'Отправить'}
						</Button>
					</Flex>
				</Flex>
			</Flex>
		</Box>
	);
};
