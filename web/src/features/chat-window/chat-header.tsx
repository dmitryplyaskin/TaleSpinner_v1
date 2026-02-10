import { Box, Group, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { $branches, $currentBranchId, $currentChat, $currentEntityProfile } from '@model/chat-core';

export const ChatHeader: React.FC = () => {
	const { t } = useTranslation();
	const [profile, chat, branches, currentBranchId] = useUnit([
		$currentEntityProfile,
		$currentChat,
		$branches,
		$currentBranchId,
	]);

	const activeBranchName = useMemo(() => {
		if (!currentBranchId) return null;
		const branch = branches.find((item) => item.id === currentBranchId);
		return branch?.title ?? currentBranchId;
	}, [branches, currentBranchId]);

	return (
		<Box className="ts-chat-header">
			<Group justify="space-between" align="center" wrap="nowrap" gap="md">
				<Text fw={700} truncate style={{ minWidth: 0 }}>
					{profile?.name ?? t('chat.head.entityFallback')}
				</Text>

				<Text c="dimmed" size="sm" truncate style={{ minWidth: 0 }}>
					{chat
						? `${chat.title}${activeBranchName ? ` • ${activeBranchName}` : ''}`
						: t('chat.head.selectChat')}
				</Text>
			</Group>
		</Box>
	);
};
