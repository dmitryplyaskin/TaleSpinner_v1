import { Box, Group, Select, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuGitBranchPlus, LuMessageSquarePlus, LuTrash2 } from 'react-icons/lu';

import {
	$branches,
	$chatsForCurrentProfile,
	$currentBranchId,
	$currentChat,
	$currentEntityProfile,
	activateBranchRequested,
	createBranchRequested,
	createChatRequested,
	deleteChatRequested,
	openChatRequested,
} from '@model/chat-core';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

export const ChatHeader: React.FC = () => {
	const { t } = useTranslation();
	const [profile, chats, chat, branches, currentBranchId] = useUnit([
		$currentEntityProfile,
		$chatsForCurrentProfile,
		$currentChat,
		$branches,
		$currentBranchId,
	]);

	const chatOptions = chats.map((c) => ({ value: c.id, label: c.title || c.id }));
	const branchOptions = branches.map((b) => ({ value: b.id, label: b.title ?? b.id }));

	return (
		<Box className="ts-chat-header">
			<Group justify="space-between" align="center" wrap="nowrap" gap="md">
				<Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
					<Text fw={700} truncate>
						{profile?.name ?? t('chat.head.entityFallback')}
					</Text>

					<Select
						data={chatOptions}
						value={chat?.id ?? null}
						onChange={(chatId) => {
							if (chatId) openChatRequested({ chatId });
						}}
						placeholder={t('chat.head.selectChat')}
						comboboxProps={{ withinPortal: false }}
						style={{ flex: 1, minWidth: 220 }}
						radius="md"
					/>

					<Group gap="xs" wrap="nowrap">
						<IconButtonWithTooltip
							tooltip={t('chat.head.createChat')}
							aria-label={t('chat.head.createChat')}
							icon={<LuMessageSquarePlus />}
							onClick={() => createChatRequested({})}
						/>
						<IconButtonWithTooltip
							tooltip={t('chat.head.deleteChat')}
							aria-label={t('chat.head.deleteChat')}
							icon={<LuTrash2 />}
							colorPalette="red"
							disabled={!chat?.id}
							onClick={() => {
								if (!chat?.id) return;
								if (!window.confirm(t('chat.head.deleteChatConfirm'))) return;
								deleteChatRequested({ chatId: chat.id });
							}}
						/>
					</Group>
				</Group>

				<Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
					<Select
						data={branchOptions}
						value={currentBranchId ?? null}
						onChange={(branchId) => {
							if (branchId) activateBranchRequested({ branchId });
						}}
						placeholder={t('chat.head.branch')}
						comboboxProps={{ withinPortal: false }}
						style={{ minWidth: 220 }}
						radius="md"
					/>
					<IconButtonWithTooltip
						tooltip={t('chat.head.createBranch')}
						aria-label={t('chat.head.createBranch')}
						icon={<LuGitBranchPlus />}
						disabled={!chat?.id || !currentBranchId}
						onClick={() => createBranchRequested({})}
					/>
				</Group>
			</Group>
		</Box>
	);
};
