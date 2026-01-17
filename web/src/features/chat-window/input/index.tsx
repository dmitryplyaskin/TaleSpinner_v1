import { Flex, Textarea, Button, Box } from '@chakra-ui/react';
import { useUnit } from 'effector-react';

import { $isCompletionsProcessing, attachCompletionsFx } from '@model/llm-orchestration';
import { $userMessage, setUserMessage } from '@model/llm-orchestration/user-message';

import { SendActionMenu } from './send-action-menu';

import type { ChangeEvent, KeyboardEvent } from 'react';

export const MessageInput = () => {
	const isProcessing = useUnit($isCompletionsProcessing);
	const message = useUnit($userMessage);

	const handleInputChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
		setUserMessage(event.target.value);
	};

	const handleSendMessage = () => {
		attachCompletionsFx('new-message');
	};

	const handleKeyPress = (event: KeyboardEvent) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSendMessage();
		}
	};

	return (
		<Box
			p={4}
			position="absolute"
			bottom="0"
			left="50%"
			transform="translateX(-50%)"
			bg="rgba(255, 255, 255, 1)"
			roundedTop={'lg'}
			w="full"
			maxW="5xl"
		>
			<Flex gap={4} flexDirection={'column'}>
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
					backgroundColor="white"
				/>
				<Flex>
					<Flex gap={2} ml={'auto'}>
						<SendActionMenu />
						<Button onClick={handleSendMessage} colorScheme={isProcessing ? 'red' : 'blue'} whiteSpace="nowrap">
							{isProcessing ? 'Оборвать' : 'Отправить'}
						</Button>
					</Flex>
				</Flex>
			</Flex>
		</Box>
	);
};
