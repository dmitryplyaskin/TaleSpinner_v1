import { Avatar } from '@ui/chakra-core-ui/avatar';
import { useUnit } from 'effector-react';
import { $currentAgentCard } from '@model/chat-service';
import { Box } from '@chakra-ui/react';

export const AssistantIcon = () => {
	const currentAgentCard = useUnit($currentAgentCard);

	const name = currentAgentCard?.name;
	const src = currentAgentCard?.avatarPath;

	return (
		<Box>
			<Avatar size="lg" name={name} src={`http://localhost:5000${src}`} bg="purple.500" />
		</Box>
	);
};
