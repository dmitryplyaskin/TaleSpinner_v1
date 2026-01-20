import { Badge, Box, Group, Loader, Select, Text } from '@mantine/core';
import { useUnit } from 'effector-react';
import React from 'react';

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
import { $pipelineRuntime } from '@model/pipeline-runtime';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';

import { LuGitBranchPlus, LuMessageSquarePlus, LuTrash2 } from 'react-icons/lu';

export const ChatHeader: React.FC = () => {
	const [profile, chats, chat, branches, currentBranchId, runtime] = useUnit([
		$currentEntityProfile,
		$chatsForCurrentProfile,
		$currentChat,
		$branches,
		$currentBranchId,
		$pipelineRuntime,
	]);

	const chatOptions = chats.map((c) => ({ value: c.id, label: c.title || c.id }));
	const branchOptions = branches.map((b) => ({ value: b.id, label: b.title ?? b.id }));

	const isRuntimeRelevant =
		Boolean(chat?.id) &&
		runtime.chatId === chat!.id &&
		// If backend reports a branch, it must match; otherwise treat as chat-scoped signal.
		(!runtime.branchId || runtime.branchId === currentBranchId);

	const runtimeStatus = isRuntimeRelevant ? runtime.status : null;
	const runtimeLabel =
		runtimeStatus === 'running'
			? 'идёт'
			: runtimeStatus === 'done'
				? 'готово'
				: runtimeStatus === 'aborted'
					? 'прервано'
					: runtimeStatus === 'error'
						? 'ошибка'
						: null;

	const runtimeColor =
		runtimeStatus === 'running'
			? 'blue'
			: runtimeStatus === 'done'
				? 'green'
				: runtimeStatus === 'aborted'
					? 'gray'
					: runtimeStatus === 'error'
						? 'red'
						: 'gray';

	return (
		<Box
			style={{
				position: 'sticky',
				top: 0,
				zIndex: 3,
				padding: 10,
				background: 'rgba(255,255,255,0.92)',
				backdropFilter: 'blur(6px)',
				borderBottom: '1px solid var(--mantine-color-gray-3)',
				borderTopLeftRadius: 12,
				borderTopRightRadius: 12,
			}}
		>
			<Group justify="space-between" align="center" wrap="nowrap" gap="md">
				<Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
					<Text fw={700} truncate>
						{profile?.name ?? 'Entity profile'}
					</Text>

					<Select
						data={chatOptions}
						value={chat?.id ?? null}
						onChange={(chatId) => {
							if (chatId) openChatRequested({ chatId });
						}}
						placeholder="Выберите чат"
						comboboxProps={{ withinPortal: false }}
						style={{ flex: 1, minWidth: 220 }}
					/>

					<Group gap="xs" wrap="nowrap">
						<IconButtonWithTooltip
							tooltip="Создать чат"
							aria-label="Create chat"
							icon={<LuMessageSquarePlus />}
							onClick={() => createChatRequested({})}
						/>
						<IconButtonWithTooltip
							tooltip="Удалить чат"
							aria-label="Delete chat"
							icon={<LuTrash2 />}
							colorPalette="red"
							disabled={!chat?.id}
							onClick={() => {
								if (!chat?.id) return;
								if (!window.confirm('Удалить чат?')) return;
								deleteChatRequested({ chatId: chat.id });
							}}
						/>
					</Group>
				</Group>

				<Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
					{runtimeStatus && runtimeStatus !== 'done' && runtimeLabel && (
						<Group gap={6} wrap="nowrap" title={runtime.lastError?.message ?? undefined}>
							{runtimeStatus === 'running' && <Loader size="xs" />}
							<Badge color={runtimeColor} variant="light">
								Pipeline: {runtimeLabel}
							</Badge>
						</Group>
					)}
					<Select
						data={branchOptions}
						value={currentBranchId ?? null}
						onChange={(branchId) => {
							if (branchId) activateBranchRequested({ branchId });
						}}
						placeholder="Ветка"
						comboboxProps={{ withinPortal: false }}
						style={{ minWidth: 220 }}
					/>
					<IconButtonWithTooltip
						tooltip="Создать ветку (fork от последнего сообщения)"
						aria-label="Create branch"
						icon={<LuGitBranchPlus />}
						disabled={!chat?.id || !currentBranchId}
						onClick={() => createBranchRequested({})}
					/>
				</Group>
			</Group>
		</Box>
	);
};

