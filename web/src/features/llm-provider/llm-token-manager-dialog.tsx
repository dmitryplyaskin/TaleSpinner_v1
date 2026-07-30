import { Alert, Badge, Button, Divider, Group, Menu, PasswordInput, Stack, Text, TextInput } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';


import { llmProviderModel } from '@model/provider';
import { Dialog } from '@ui/dialog';
import { DotsThreeIcon, KeyIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@ui/icons';
import { toaster } from '@ui/toaster';

import type { LlmProviderId, LlmTokenListItem } from '@shared/types/llm';

type Props = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	providerId: LlmProviderId;
	providerName?: string;
	activeTokenId?: string | null;
	tokenItems?: LlmTokenListItem[];
	onTokenSelected?: (tokenId: string | null) => void;
	onTokensChanged?: () => Promise<void> | void;
};

type EditorMode = { type: 'list' } | { type: 'create' } | { type: 'edit'; token: LlmTokenListItem };

export const LlmTokenManagerDialog: React.FC<Props> = ({
	open,
	onOpenChange,
	providerId,
	providerName,
	activeTokenId = null,
	tokenItems,
	onTokenSelected,
	onTokensChanged,
}) => {
	const { t } = useTranslation();
	const [
		tokensByProviderId,
		createTokenFx,
		patchTokenFx,
		deleteTokenFx,
		loadTokensFx,
		isCreating,
		isPatching,
		isDeleting,
	] = useUnit([
		llmProviderModel.$tokensByProviderId,
		llmProviderModel.createTokenFx,
		llmProviderModel.patchTokenFx,
		llmProviderModel.deleteTokenFx,
		llmProviderModel.loadTokensFx,
		llmProviderModel.createTokenFx.pending,
		llmProviderModel.patchTokenFx.pending,
		llmProviderModel.deleteTokenFx.pending,
	]);
	const tokens = useMemo(
		() => tokenItems ?? tokensByProviderId[providerId] ?? [],
		[providerId, tokenItems, tokensByProviderId],
	);
	const [mode, setMode] = useState<EditorMode>({ type: 'list' });
	const [name, setName] = useState('');
	const [tokenValue, setTokenValue] = useState('');
	const [deletingToken, setDeletingToken] = useState<LlmTokenListItem | null>(null);

	const resetEditor = () => {
		setMode({ type: 'list' });
		setName('');
		setTokenValue('');
		setDeletingToken(null);
	};

	const handleOpenChange = (nextOpen: boolean) => {
		onOpenChange(nextOpen);
		if (!nextOpen) resetEditor();
	};

	const startCreate = () => {
		setName('');
		setTokenValue('');
		setMode({ type: 'create' });
	};

	const startEdit = (token: LlmTokenListItem) => {
		setName(token.name);
		setTokenValue('');
		setMode({ type: 'edit', token });
	};

	const submit = async () => {
		try {
			if (mode.type === 'create') {
				const created = await createTokenFx({ providerId, name: name.trim(), token: tokenValue.trim() });
				await loadTokensFx(providerId);
				await onTokensChanged?.();
				onTokenSelected?.(created.id);
				toaster.success({ title: t('tokenManager.toasts.created') });
			} else if (mode.type === 'edit') {
				await patchTokenFx({ id: mode.token.id, name: name.trim(), token: tokenValue.trim() || undefined });
				await loadTokensFx(providerId);
				await onTokensChanged?.();
				toaster.success({ title: t('tokenManager.toasts.saved') });
			}
			resetEditor();
		} catch (error) {
			toaster.error({
				title: t('tokenManager.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const submitDelete = async () => {
		if (!deletingToken) return;
		try {
			await deleteTokenFx(deletingToken.id);
			await loadTokensFx(providerId);
			await onTokensChanged?.();
			if (deletingToken.id === activeTokenId) onTokenSelected?.(null);
			toaster.success({ title: t('tokenManager.toasts.deleted') });
			setDeletingToken(null);
		} catch (error) {
			toaster.error({
				title: t('tokenManager.toasts.failed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const isSubmitDisabled = !name.trim() || (mode.type === 'create' && !tokenValue.trim());
	const isBusy = isCreating || isPatching || isDeleting;

	return (
		<Dialog
			open={open}
			onOpenChange={handleOpenChange}
			title={t('tokenManager.titleWithProvider', { providerName: providerName ?? providerId })}
			size="lg"
			showCloseButton
			closeOnEscape={!isBusy}
			closeOnInteractOutside={false}
			footer={
				<Button variant="subtle" onClick={() => handleOpenChange(false)} disabled={isBusy}>
					{t('common.close')}
				</Button>
			}
		>
			{mode.type === 'list' ? (
				<Stack gap="sm">
					<Group justify="space-between">
						<Stack gap={1}>
							<Text fw={600}>{t('tokenManager.savedTitle')}</Text>
							<Text size="sm" c="dimmed">
								{t('tokenManager.savedHint')}
							</Text>
						</Stack>
						<Button size="xs" leftSection={<PlusIcon />} onClick={startCreate}>
							{t('tokenManager.addToken')}
						</Button>
					</Group>

					{tokens.length === 0 ? (
						<Stack align="center" gap="xs" py="xl">
							<KeyIcon size={28} />
							<Text fw={600}>{t('tokenManager.emptyTitle')}</Text>
							<Text size="sm" c="dimmed" ta="center">
								{t('tokenManager.empty')}
							</Text>
							<Button size="sm" onClick={startCreate}>
								{t('tokenManager.addFirst')}
							</Button>
						</Stack>
					) : (
						<Stack gap={0}>
							{tokens.map((token, index) => (
								<Stack key={token.id} gap="xs" py="sm">
									<Group justify="space-between" wrap="nowrap">
										<Stack gap={2} style={{ minWidth: 0 }}>
											<Group gap="xs" wrap="nowrap">
												<Text fw={600} truncate>
													{token.name}
												</Text>
												{token.id === activeTokenId ? (
													<Badge size="sm" variant="light">
														{t('tokenManager.active')}
													</Badge>
												) : null}
											</Group>
											<Text size="sm" c="dimmed">
												{token.tokenHint}
											</Text>
											{token.lastUsedAt ? (
												<Text size="xs" c="dimmed">
													{t('tokenManager.lastUsed', { value: new Date(token.lastUsedAt).toLocaleString() })}
												</Text>
											) : null}
										</Stack>
										<Group gap="xs" wrap="nowrap">
											{token.id !== activeTokenId ? (
												<Button size="compact-sm" variant="subtle" onClick={() => onTokenSelected?.(token.id)}>
													{t('tokenManager.use')}
												</Button>
											) : null}
											<Menu position="bottom-end" withinPortal>
												<Menu.Target>
													<Button variant="subtle" size="compact-sm" px={8} aria-label={t('tokenManager.actions')}>
														<DotsThreeIcon />
													</Button>
												</Menu.Target>
												<Menu.Dropdown>
													<Menu.Item leftSection={<PencilSimpleIcon />} onClick={() => startEdit(token)}>
														{t('common.edit')}
													</Menu.Item>
													<Menu.Item color="red" leftSection={<TrashIcon />} onClick={() => setDeletingToken(token)}>
														{t('common.delete')}
													</Menu.Item>
												</Menu.Dropdown>
											</Menu>
										</Group>
									</Group>
									{index < tokens.length - 1 ? <Divider /> : null}
								</Stack>
							))}
						</Stack>
					)}

					{deletingToken ? (
						<Alert color="red" title={t('tokenManager.deleteConfirmTitle')}>
							<Stack gap="sm">
								<Text size="sm">{t('tokenManager.deleteConfirmText', { name: deletingToken.name })}</Text>
								<Group justify="flex-end">
									<Button size="xs" variant="subtle" onClick={() => setDeletingToken(null)}>
										{t('common.cancel')}
									</Button>
									<Button size="xs" color="red" loading={isDeleting} onClick={() => void submitDelete()}>
										{t('common.delete')}
									</Button>
								</Group>
							</Stack>
						</Alert>
					) : null}
				</Stack>
			) : (
				<Stack gap="sm">
					<Stack gap={1}>
						<Text fw={600}>{t(mode.type === 'create' ? 'tokenManager.addToken' : 'tokenManager.editToken')}</Text>
						<Text size="sm" c="dimmed">
							{t(mode.type === 'create' ? 'tokenManager.createHint' : 'tokenManager.editHint')}
						</Text>
					</Stack>
					<TextInput
						label={t('tokenManager.fields.name')}
						value={name}
						onChange={(event) => setName(event.currentTarget.value)}
						autoFocus
					/>
					<PasswordInput
						label={t(mode.type === 'create' ? 'tokenManager.fields.token' : 'tokenManager.fields.newToken')}
						description={
							mode.type === 'edit' ? t('tokenManager.fields.currentHint', { hint: mode.token.tokenHint }) : undefined
						}
						value={tokenValue}
						onChange={(event) => setTokenValue(event.currentTarget.value)}
					/>
					<Group justify="flex-end">
						<Button variant="subtle" onClick={resetEditor} disabled={isBusy}>
							{t('common.cancel')}
						</Button>
						<Button onClick={() => void submit()} loading={isCreating || isPatching} disabled={isSubmitDisabled}>
							{t('common.save')}
						</Button>
					</Group>
				</Stack>
			)}
		</Dialog>
	);
};
