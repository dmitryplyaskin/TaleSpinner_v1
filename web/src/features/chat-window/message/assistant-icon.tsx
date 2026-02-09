import { Avatar } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useTranslation } from 'react-i18next';

import { $currentEntityProfile } from '@model/chat-core';

type AssistantIconProps = {
	size?: number;
};

export const AssistantIcon = ({ size = 64 }: AssistantIconProps) => {
	const { t } = useTranslation();
	const profile = useUnit($currentEntityProfile);

	const name = profile?.name;

	return <Avatar size={size} name={name ?? t('chat.message.assistantFallback')} color="cyan" radius="xl" />;
};
