import { VStack } from '@chakra-ui/react';
import { Message } from './message';
import { $currentChatHistoryMessages } from '@model/chats';
import { useList } from 'effector-react';

type Props = {};

export const RenderChat: React.FC<Props> = () => {
	const messages = useList($currentChatHistoryMessages, (message, index) => <Message key={index} data={message} />);

	if (!messages) return null;

	return (
		<VStack gap={4} align="stretch">
			{messages}
		</VStack>
	);
};
