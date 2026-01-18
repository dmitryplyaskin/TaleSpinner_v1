import { useUnit } from 'effector-react';

import { $currentAgentCard } from '@model/chat-service';
import { Avatar } from '@mantine/core';

type AssistantIconProps = {
	size?: number;
};

export const AssistantIcon = ({ size = 64 }: AssistantIconProps) => {
	const currentAgentCard = useUnit($currentAgentCard);

	const name = currentAgentCard?.name;
	const src = currentAgentCard?.avatarPath;
	const fullSrc = src ? `http://localhost:5000${src}` : undefined;

	return (
		<Avatar size={size} name={name ?? 'AI Assistant'} src={fullSrc} color="violet" radius="xl" />
	);
};
