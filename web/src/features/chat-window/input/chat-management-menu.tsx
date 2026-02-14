import { ActionIcon, Badge, Box, Button, Checkbox, Group, Menu, Paper, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuBookOpenText, LuCheck, LuFolderGit2, LuMessageSquare, LuPencil, LuPlus, LuSettings2, LuTrash2, LuX } from 'react-icons/lu';

import {
	$branches,
	$chatsForCurrentProfile,
	$currentBranchId,
	$currentChat,
	$currentEntityProfile,
	activateBranchRequested,
	createBranchRequested,
	createChatRequested,
	deleteBranchRequested,
	deleteChatRequested,
	openChatRequested,
	quickCreateChatFx,
	quickCreateChatRequested,
	updateBranchTitleRequested,
	updateChatTitleRequested,
} from '@model/chat-core';
import { $isBulkDeleteMode, enterBulkDeleteMode } from '@model/chat-entry-parts';
import { Dialog } from '@ui/dialog';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { Z_INDEX } from '@ui/z-index';

import { getLatestWorldInfoActivations, type LatestWorldInfoActivationsResponse } from '../../../api/chat-entry-parts';

function normalizeName(value: string): string {
	return value.trim();
}

export const ChatManagementMenu = () => {
	const { t } = useTranslation();
	const [chats, currentChat, branches, currentBranchId, currentProfile, isBulkDeleteMode, startBulkDeleteMode, quickCreatePending, requestQuickCreate] = useUnit([
		$chatsForCurrentProfile,
		$currentChat,
		$branches,
		$currentBranchId,
		$currentEntityProfile,
		$isBulkDeleteMode,
		enterBulkDeleteMode,
		quickCreateChatFx.pending,
		quickCreateChatRequested,
	]);

	const [quickCreateModalOpen, setQuickCreateModalOpen] = useState(false);
	const [deleteCurrentOnQuickCreate, setDeleteCurrentOnQuickCreate] = useState(false);
	const [chatsModalOpen, setChatsModalOpen] = useState(false);
	const [branchesModalOpen, setBranchesModalOpen] = useState(false);
	const [worldInfoModalOpen, setWorldInfoModalOpen] = useState(false);
	const [worldInfoLoading, setWorldInfoLoading] = useState(false);
	const [worldInfoError, setWorldInfoError] = useState<string | null>(null);
	const [worldInfoData, setWorldInfoData] = useState<LatestWorldInfoActivationsResponse | null>(null);
	const [editingChatId, setEditingChatId] = useState<string | null>(null);
	const [editingChatName, setEditingChatName] = useState('');
	const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
	const [editingBranchName, setEditingBranchName] = useState('');

	const currentChatId = currentChat?.id ?? null;

	const canManageBranches = Boolean(currentChatId);
	const hasCurrentBranch = Boolean(currentBranchId);

	const loadLatestWorldInfoActivations = async () => {
		if (!currentChatId) return;
		setWorldInfoModalOpen(true);
		setWorldInfoLoading(true);
		setWorldInfoError(null);
		try {
			const data = await getLatestWorldInfoActivations({
				chatId: currentChatId,
				branchId: currentBranchId ?? undefined,
			});
			setWorldInfoData(data);
		} catch (error) {
			setWorldInfoData(null);
			setWorldInfoError(error instanceof Error ? error.message : String(error));
		} finally {
			setWorldInfoLoading(false);
		}
	};

	const sortedChats = useMemo(
		() => [...chats].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
		[chats],
	);
	const currentBranchTitle = useMemo(() => {
		if (!currentBranchId) return null;
		const branch = branches.find((item) => item.id === currentBranchId);
		return branch?.title?.trim() || branch?.id || null;
	}, [branches, currentBranchId]);

	const handleStartEditChat = (chatId: string, title: string) => {
		setEditingChatId(chatId);
		setEditingChatName(title);
	};

	const handleSaveEditChat = () => {
		if (!editingChatId) return;
		const title = normalizeName(editingChatName);
		if (!title) return;
		updateChatTitleRequested({ chatId: editingChatId, title });
		setEditingChatId(null);
		setEditingChatName('');
	};

	const handleStartEditBranch = (branchId: string, title: string) => {
		setEditingBranchId(branchId);
		setEditingBranchName(title);
	};

	const handleSaveEditBranch = () => {
		if (!editingBranchId || !currentChatId) return;
		const title = normalizeName(editingBranchName);
		if (!title) return;
		updateBranchTitleRequested({ chatId: currentChatId, branchId: editingBranchId, title });
		setEditingBranchId(null);
		setEditingBranchName('');
	};

	const handleQuickCreateOpenChange = (open: boolean) => {
		setQuickCreateModalOpen(open);
		if (!open) {
			setDeleteCurrentOnQuickCreate(false);
		}
	};

	const handleQuickCreateConfirm = () => {
		requestQuickCreate({ deleteCurrentChat: deleteCurrentOnQuickCreate });
		handleQuickCreateOpenChange(false);
	};

	return (
		<>
			<Menu withinPortal zIndex={Z_INDEX.overlay.popup} position="top-start">
				<Menu.Target>
					<span>
						<IconButtonWithTooltip
							tooltip={t('chat.management.openMenu')}
							aria-label={t('chat.management.openMenu')}
							icon={<LuSettings2 />}
						/>
					</span>
				</Menu.Target>
				<Menu.Dropdown>
					<Box px="sm" py={6}>
						<Text fw={600} size="sm" style={{ maxWidth: 280 }} truncate>
							{currentProfile?.name ?? t('chat.head.entityFallback')}
						</Text>
						<Text c="dimmed" size="xs" style={{ maxWidth: 280 }} truncate>
							{currentChat
								? `${currentChat.title}${currentBranchTitle ? ` • ${currentBranchTitle}` : ''}`
								: t('chat.head.selectChat')}
						</Text>
					</Box>
					<Menu.Divider />
					<Menu.Item leftSection={<LuPlus />} onClick={() => handleQuickCreateOpenChange(true)}>
						{t('chat.management.quickCreateChat')}
					</Menu.Item>
					<Menu.Item leftSection={<LuMessageSquare />} onClick={() => setChatsModalOpen(true)}>
						{t('chat.management.manageChats')}
					</Menu.Item>
					<Menu.Item
						leftSection={<LuFolderGit2 />}
						disabled={!canManageBranches}
						onClick={() => setBranchesModalOpen(true)}
					>
						{t('chat.management.manageBranches')}
					</Menu.Item>
					<Menu.Item
						leftSection={<LuTrash2 />}
						disabled={!currentChatId || isBulkDeleteMode}
						onClick={() => startBulkDeleteMode()}
					>
						{t('chat.management.bulkDelete')}
					</Menu.Item>
					<Menu.Item leftSection={<LuBookOpenText />} disabled={!currentChatId} onClick={() => void loadLatestWorldInfoActivations()}>
						{t('chat.management.latestWorldInfoActivations')}
					</Menu.Item>
				</Menu.Dropdown>
			</Menu>

			<Dialog
				open={quickCreateModalOpen}
				onOpenChange={handleQuickCreateOpenChange}
				title={t('chat.management.quickCreateTitle')}
				size="sm"
				footer={
					<>
						<Button variant="subtle" onClick={() => handleQuickCreateOpenChange(false)} disabled={quickCreatePending}>
							{t('chat.management.quickCreateNo')}
						</Button>
						<Button color="cyan" onClick={handleQuickCreateConfirm} loading={quickCreatePending}>
							{t('chat.management.quickCreateYes')}
						</Button>
					</>
				}
			>
				<Stack gap="sm">
					<Text size="sm">{t('chat.management.quickCreateQuestion')}</Text>
					{currentChatId && (
						<Checkbox
							checked={deleteCurrentOnQuickCreate}
							onChange={(event) => setDeleteCurrentOnQuickCreate(event.currentTarget.checked)}
							label={t('chat.management.quickCreateDeleteCurrent')}
						/>
					)}
				</Stack>
			</Dialog>

			<Dialog
				open={chatsModalOpen}
				onOpenChange={(open) => {
					setChatsModalOpen(open);
					if (!open) {
						setEditingChatId(null);
						setEditingChatName('');
					}
				}}
				title={t('chat.management.chatsTitle')}
				size={560}
				footer={<></>}
			>
				<Group justify="space-between" align="center">
					<Text size="sm" c="dimmed">
						{t('chat.management.chatsTitle')}
					</Text>
					<ActionIcon
						variant="light"
						color="cyan"
						aria-label={t('chat.management.createChat')}
						onClick={() => createChatRequested({})}
					>
						<LuPlus />
					</ActionIcon>
				</Group>

				<Stack gap="sm" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
					{sortedChats.map((chat) => {
						const isActive = chat.id === currentChatId;
						const isEditing = editingChatId === chat.id;
						return (
							<Paper
								key={chat.id}
								withBorder
								p="sm"
								radius="md"
								style={{
									borderColor: isActive ? 'var(--mantine-color-cyan-6)' : undefined,
									boxShadow: isActive ? '0 0 0 2px var(--ts-accent-soft)' : undefined,
								}}
							>
								<Group justify="space-between" align="flex-start" wrap="nowrap">
									<Box style={{ minWidth: 0, flex: 1, cursor: isEditing ? 'default' : 'pointer' }} onClick={() => !isEditing && openChatRequested({ chatId: chat.id })}>
										{isEditing ? (
											<TextInput
												value={editingChatName}
												onChange={(event) => setEditingChatName(event.currentTarget.value)}
												autoFocus
												onKeyDown={(event) => {
													if (event.key === 'Enter') {
														event.preventDefault();
														handleSaveEditChat();
													}
													if (event.key === 'Escape') {
														event.preventDefault();
														setEditingChatId(null);
														setEditingChatName('');
													}
												}}
											/>
										) : (
											<>
												<Group gap={6} wrap="nowrap">
													<Text fw={600} truncate>
														{chat.title}
													</Text>
													{isActive && (
														<Badge size="xs" color="cyan" variant="light">
															{t('chat.management.active')}
														</Badge>
													)}
												</Group>
												<Text size="xs" c="dimmed" lineClamp={1}>
													{chat.lastMessagePreview?.trim() || t('chat.management.noMessages')}
												</Text>
											</>
										)}
									</Box>

									<Group gap={4} wrap="nowrap">
										{isEditing ? (
											<>
												<ActionIcon variant="subtle" color="green" onClick={handleSaveEditChat} aria-label={t('chat.management.saveRename')}>
													<LuCheck />
												</ActionIcon>
												<ActionIcon
													variant="subtle"
													color="gray"
													onClick={() => {
														setEditingChatId(null);
														setEditingChatName('');
													}}
													aria-label={t('chat.management.cancelRename')}
												>
													<LuX />
												</ActionIcon>
											</>
										) : (
											<ActionIcon
												variant="subtle"
												color="gray"
												onClick={() => handleStartEditChat(chat.id, chat.title)}
												aria-label={t('chat.management.renameChat')}
											>
												<LuPencil />
											</ActionIcon>
										)}
										<ActionIcon
											variant="subtle"
											color="red"
											aria-label={t('chat.management.deleteChat')}
											onClick={() => {
												if (!window.confirm(t('chat.management.deleteChatConfirm', { name: chat.title }))) return;
												deleteChatRequested({ chatId: chat.id });
											}}
										>
											<LuTrash2 />
										</ActionIcon>
									</Group>
								</Group>
							</Paper>
						);
					})}
				</Stack>
			</Dialog>

			<Dialog
				open={branchesModalOpen}
				onOpenChange={(open) => {
					setBranchesModalOpen(open);
					if (!open) {
						setEditingBranchId(null);
						setEditingBranchName('');
					}
				}}
				title={t('chat.management.branchesTitle')}
				size={560}
				footer={<></>}
			>
				<Group justify="space-between" align="center">
					<Text size="sm" c="dimmed">
						{t('chat.management.branchesTitle')}
					</Text>
					<ActionIcon
						variant="light"
						color="cyan"
						aria-label={t('chat.management.createBranch')}
						disabled={!currentChatId || !hasCurrentBranch}
						onClick={() => createBranchRequested({})}
					>
						<LuPlus />
					</ActionIcon>
				</Group>

				<Stack gap="sm" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
					{!currentChatId ? (
						<Text c="dimmed">{t('chat.management.selectChatFirst')}</Text>
					) : (
						branches.map((branch) => {
							const isActive = branch.id === currentBranchId;
							const isEditing = editingBranchId === branch.id;
							const branchTitle = branch.title?.trim() || branch.id;
							return (
								<Paper
									key={branch.id}
									withBorder
									p="sm"
									radius="md"
									style={{
										borderColor: isActive ? 'var(--mantine-color-cyan-6)' : undefined,
										boxShadow: isActive ? '0 0 0 2px var(--ts-accent-soft)' : undefined,
									}}
								>
									<Group justify="space-between" align="flex-start" wrap="nowrap">
										<Box
											style={{ minWidth: 0, flex: 1, cursor: isEditing ? 'default' : 'pointer' }}
											onClick={() => !isEditing && activateBranchRequested({ branchId: branch.id })}
										>
											{isEditing ? (
												<TextInput
													value={editingBranchName}
													onChange={(event) => setEditingBranchName(event.currentTarget.value)}
													autoFocus
													onKeyDown={(event) => {
														if (event.key === 'Enter') {
															event.preventDefault();
															handleSaveEditBranch();
														}
														if (event.key === 'Escape') {
															event.preventDefault();
															setEditingBranchId(null);
															setEditingBranchName('');
														}
													}}
												/>
											) : (
												<Group gap={6} wrap="nowrap">
													<Text fw={600} truncate>
														{branchTitle}
													</Text>
													{isActive && (
														<Badge size="xs" color="cyan" variant="light">
															{t('chat.management.active')}
														</Badge>
													)}
												</Group>
											)}
										</Box>

										<Group gap={4} wrap="nowrap">
											{isEditing ? (
												<>
													<ActionIcon variant="subtle" color="green" onClick={handleSaveEditBranch} aria-label={t('chat.management.saveRename')}>
														<LuCheck />
													</ActionIcon>
													<ActionIcon
														variant="subtle"
														color="gray"
														onClick={() => {
															setEditingBranchId(null);
															setEditingBranchName('');
														}}
														aria-label={t('chat.management.cancelRename')}
													>
														<LuX />
													</ActionIcon>
												</>
											) : (
												<ActionIcon
													variant="subtle"
													color="gray"
													onClick={() => handleStartEditBranch(branch.id, branchTitle)}
													aria-label={t('chat.management.renameBranch')}
												>
													<LuPencil />
												</ActionIcon>
											)}
											<ActionIcon
												variant="subtle"
												color="red"
												aria-label={t('chat.management.deleteBranch')}
												onClick={() => {
													if (!currentChatId) return;
													if (!window.confirm(t('chat.management.deleteBranchConfirm', { name: branchTitle }))) return;
													deleteBranchRequested({ chatId: currentChatId, branchId: branch.id });
												}}
											>
												<LuTrash2 />
											</ActionIcon>
										</Group>
									</Group>
								</Paper>
							);
						})
					)}
				</Stack>
			</Dialog>

			<Dialog
				open={worldInfoModalOpen}
				onOpenChange={(open) => {
					setWorldInfoModalOpen(open);
					if (!open) {
						setWorldInfoData(null);
						setWorldInfoError(null);
						setWorldInfoLoading(false);
					}
				}}
				title={t('chat.management.latestWorldInfoActivationsTitle')}
				size={720}
				footer={<></>}
			>
				<Stack gap="sm" style={{ maxHeight: '62vh', overflowY: 'auto' }}>
					{worldInfoLoading && <Text c="dimmed">{t('chat.management.latestWorldInfoLoading')}</Text>}
					{!worldInfoLoading && worldInfoError && (
						<Text c="red">
							{t('chat.management.latestWorldInfoError')}: {worldInfoError}
						</Text>
					)}
					{!worldInfoLoading && !worldInfoError && worldInfoData && worldInfoData.generationId === null && (
						<Text c="dimmed">{t('chat.management.latestWorldInfoEmpty')}</Text>
					)}
					{!worldInfoLoading && !worldInfoError && worldInfoData && worldInfoData.generationId !== null && (
						<>
							<Paper withBorder p="sm" radius="md">
								<Stack gap={2}>
									<Text size="sm">
										{t('chat.management.latestWorldInfoGenerationId')}: {worldInfoData.generationId}
									</Text>
									<Text size="sm">
										{t('chat.management.latestWorldInfoStartedAt')}:{' '}
										{worldInfoData.startedAt ? new Date(worldInfoData.startedAt).toLocaleString() : '-'}
									</Text>
									<Text size="sm">
										{t('chat.management.latestWorldInfoStatus')}: {worldInfoData.status ?? '-'}
									</Text>
									<Text size="sm">
										{t('chat.management.latestWorldInfoActivatedCount')}: {worldInfoData.activatedCount}
									</Text>
								</Stack>
							</Paper>

							{worldInfoData.warnings.length > 0 && (
								<Paper withBorder p="sm" radius="md">
									<Text size="sm" fw={600} mb={6}>
										{t('chat.management.latestWorldInfoWarnings')}
									</Text>
									<Stack gap={4}>
										{worldInfoData.warnings.map((warning) => (
											<Text key={warning} size="sm" c="orange.7">
												{warning}
											</Text>
										))}
									</Stack>
								</Paper>
							)}

							{worldInfoData.entries.length === 0 ? (
								<Text c="dimmed">{t('chat.management.latestWorldInfoNoEntries')}</Text>
							) : (
								worldInfoData.entries.map((entry) => (
									<Paper key={`${entry.hash}-${entry.uid}`} withBorder p="sm" radius="md">
										<Stack gap={6}>
											<Group justify="space-between" align="center">
												<Text fw={600} size="sm">
													{entry.comment?.trim() || `${entry.bookName} #${entry.uid}`}
												</Text>
												<Badge size="xs" variant="light" color="cyan">
													{entry.bookName}
												</Badge>
											</Group>
											<Text size="xs" c="dimmed">
												uid: {entry.uid} • hash: {entry.hash}
											</Text>
											<Group gap={6}>
												{entry.reasons.map((reason) => (
													<Badge key={reason} size="xs" variant="filled" color="blue">
														{reason}
													</Badge>
												))}
												{entry.matchedKeys.map((key) => (
													<Badge key={key} size="xs" variant="light" color="gray">
														{key}
													</Badge>
												))}
											</Group>
											<Text size="sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
												{entry.content}
											</Text>
										</Stack>
									</Paper>
								))
							)}
						</>
					)}
				</Stack>
			</Dialog>
		</>
	);
};
