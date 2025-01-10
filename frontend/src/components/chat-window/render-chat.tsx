import { ChatCard } from '../../types/chat';
import { VStack } from '@chakra-ui/react';
import { Message } from './message';

type Props = {
	chatCard: ChatCard | null;
};

export const RenderChat: React.FC<Props> = ({ chatCard }) => {
	if (!chatCard) return null;
	if (!chatCard.currentChat) return null;

	return (
		<VStack gap={4} align="stretch">
			{chatCard.currentChat?.messages.map((message, index) => (
				<Message key={index} data={message} />
			))}
		</VStack>
	);
};
