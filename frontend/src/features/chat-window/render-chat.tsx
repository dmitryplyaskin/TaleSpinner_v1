import { VStack } from '@chakra-ui/react';
import { Message } from './message/message';
import { $currentChat } from '@model/chat-service';
import { useList } from 'effector-react';

type Props = {};

export const RenderChat: React.FC<Props> = () => {
	const messages = useList($currentChat, (message, index) => <Message key={index} data={message} />);

	if (!messages) return null;

	return (
		<VStack gap={4} align="stretch">
			{messages}
		</VStack>
	);
};
