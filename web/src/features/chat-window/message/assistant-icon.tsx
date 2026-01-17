import { Box } from '@chakra-ui/react';
import { useUnit } from 'effector-react';

import { $currentAgentCard } from '@model/chat-service';
import { Avatar, type AvatarProps } from '@ui/chakra-core-ui/avatar';

type AssistantIconProps = {
	size?: AvatarProps['size'];
	boxSize?: AvatarProps['boxSize'];
};

export const AssistantIcon = ({ size = 'xl', boxSize = '16' }: AssistantIconProps) => {
	const currentAgentCard = useUnit($currentAgentCard);

	const name = currentAgentCard?.name;
	const src = currentAgentCard?.avatarPath;

	return (
		<Box>
			<Avatar size={size} boxSize={boxSize} name={name} src={`http://localhost:5000${src}`} bg="purple.500" />
		</Box>
	);
};
