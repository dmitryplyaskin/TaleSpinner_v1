import { useUnit } from 'effector-react';

import { $currentEntityProfile } from '@model/chat-core';
import { Avatar } from '@mantine/core';

type AssistantIconProps = {
	size?: number;
};

export const AssistantIcon = ({ size = 64 }: AssistantIconProps) => {
	const profile = useUnit($currentEntityProfile);

	const name = profile?.name;

	return (
		<Avatar size={size} name={name ?? 'AI Assistant'} color="violet" radius="xl" />
	);
};
