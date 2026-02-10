import { Avatar } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useTranslation } from 'react-i18next';

import { $currentEntityProfile } from '@model/chat-core';

import { BACKEND_ORIGIN } from '../../../api/chat-core';

type AssistantIconProps = {
	size?: number;
	src?: string;
	name?: string;
	onClick?: () => void;
};

export const AssistantIcon = ({ size = 64, src, name, onClick }: AssistantIconProps) => {
	const { t } = useTranslation();
	const profile = useUnit($currentEntityProfile);

	const resolvedName = name ?? profile?.name ?? t('chat.message.assistantFallback');
	const resolvedSrc = src ?? (profile?.avatarAssetId ? `${BACKEND_ORIGIN}${profile.avatarAssetId}` : undefined);
	const canOpenPreview = Boolean(onClick && resolvedSrc);

	return (
		<Avatar
			size={size}
			name={resolvedName}
			src={resolvedSrc}
			color="cyan"
			radius="xl"
			onClick={canOpenPreview ? onClick : undefined}
			style={canOpenPreview ? { cursor: 'zoom-in' } : undefined}
		/>
	);
};
