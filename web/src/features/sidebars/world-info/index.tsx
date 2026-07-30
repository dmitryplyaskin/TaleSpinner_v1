import { Accordion, Button, Group, Paper, Select, Stack, Text } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';


import {
	$worldInfoGlobalBookId,
	$worldInfoEditorLaunch,
	$selectedWorldInfoBook,
	$selectedWorldInfoBookId,
	$worldInfoBooks,
	$worldInfoSettings,
	createWorldInfoBookFx,
	deleteWorldInfoBookFx,
	duplicateWorldInfoBookFx,
	importWorldInfoBookFx,
	loadWorldInfoBooksFx,
	loadWorldInfoGlobalBindingsFx,
	loadWorldInfoSettingsFx,
	saveWorldInfoBookFx,
	saveWorldInfoSettingsFx,
	setWorldInfoBookBoundToGlobalRequested,
	worldInfoBookCreateRequested,
	worldInfoBookDeleteRequested,
	worldInfoBookDuplicateRequested,
	worldInfoBookSaveRequested,
	worldInfoBookSelected,
	worldInfoImportBookRequested,
	worldInfoSettingsSaveRequested,
} from '@model/world-info';
import { Drawer } from '@ui/drawer';
import { EXPORT_FILE_ICON, IMPORT_FILE_ICON } from '@ui/file-transfer-icons';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { CopyIcon, PencilSimpleIcon, PlusIcon, ArrowsClockwiseIcon, TrashIcon } from '@ui/icons';
import { toaster } from '@ui/toaster';

import { exportWorldInfoBookToStNative, type WorldInfoSettingsDto } from '../../../api/world-info';

import { WorldInfoEditorModal } from './world-info-editor-modal';
import { WorldInfoSettingsPanel } from './world-info-settings-panel';

export const WorldInfoSidebar = () => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [editorOpen, setEditorOpen] = useState(false);
	const isMobile = useMediaQuery('(max-width: 48em)');

	const [books, selectedId, selectedBook, settings, globalBookId, worldInfoEditorLaunch] = useUnit([
		$worldInfoBooks,
		$selectedWorldInfoBookId,
		$selectedWorldInfoBook,
		$worldInfoSettings,
		$worldInfoGlobalBookId,
		$worldInfoEditorLaunch,
	]);

	const [settingsDraft, setSettingsDraft] = useState<Partial<WorldInfoSettingsDto> | null>(null);

	useEffect(() => {
		if (!settings) {
			setSettingsDraft(null);
			return;
		}
		setSettingsDraft({
			scanDepth: settings.scanDepth,
			minActivations: settings.minActivations,
			minDepthMax: settings.minDepthMax,
			maxRecursionSteps: settings.maxRecursionSteps,
			insertionStrategy: settings.insertionStrategy,
			overflowAlert: settings.overflowAlert,
			budgetPercent: settings.budgetPercent,
			budgetCapTokens: settings.budgetCapTokens,
			contextWindowTokens: settings.contextWindowTokens,
			recursive: settings.recursive,
			caseSensitive: settings.caseSensitive,
			matchWholeWords: settings.matchWholeWords,
			useGroupScoring: settings.useGroupScoring,
			includeNames: settings.includeNames,
		});
	}, [settings]);

	useEffect(() => {
		if (worldInfoEditorLaunch.nonce === 0) return;
		worldInfoBookSelected(worldInfoEditorLaunch.bookId);
		setEditorOpen(Boolean(worldInfoEditorLaunch.bookId));
	}, [worldInfoEditorLaunch]);

	const [isCreatePending, isDuplicatePending, isDeletePending, isSaveBookPending, isSaveSettingsPending, isImportPending] = useUnit([
		createWorldInfoBookFx.pending,
		duplicateWorldInfoBookFx.pending,
		deleteWorldInfoBookFx.pending,
		saveWorldInfoBookFx.pending,
		saveWorldInfoSettingsFx.pending,
		importWorldInfoBookFx.pending,
	]);
	const isBusy =
		isCreatePending || isDuplicatePending || isDeletePending || isSaveBookPending || isSaveSettingsPending || isImportPending;

	const bookOptions = useMemo(() => books.map((item) => ({ value: item.id, label: item.name })), [books]);
	const globalBindingOptions = useMemo(
		() => [{ value: '__none__', label: t('worldInfo.globalBinding.none') }, ...bookOptions],
		[bookOptions, t],
	);
	const globalBoundBook = useMemo(
		() => books.find((item) => item.id === globalBookId) ?? null,
		[books, globalBookId],
	);

	const handleSaveSettings = () => {
		if (!settingsDraft) return;
		worldInfoSettingsSaveRequested({
			patch: {
				scanDepth: settingsDraft.scanDepth,
				minActivations: settingsDraft.minActivations,
				minDepthMax: settingsDraft.minDepthMax,
				maxRecursionSteps: settingsDraft.maxRecursionSteps,
				insertionStrategy: settingsDraft.insertionStrategy as 0 | 1 | 2 | undefined,
				overflowAlert: settingsDraft.overflowAlert,
				budgetPercent: settingsDraft.budgetPercent,
				budgetCapTokens: settingsDraft.budgetCapTokens,
				contextWindowTokens: settingsDraft.contextWindowTokens,
				recursive: settingsDraft.recursive,
				caseSensitive: settingsDraft.caseSensitive,
				matchWholeWords: settingsDraft.matchWholeWords,
				useGroupScoring: settingsDraft.useGroupScoring,
				includeNames: settingsDraft.includeNames,
			},
		});
	};

	const handleExport = async () => {
		if (!selectedBook) return;
		try {
			const payload = await exportWorldInfoBookToStNative(selectedBook.id);
			const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `world-info-${selectedBook.slug}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
		} catch (error) {
			toaster.error({
				title: t('worldInfo.toasts.exportFailed'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;
		worldInfoImportBookRequested({ file });
		if (fileInputRef.current) fileInputRef.current.value = '';
	};

	return (
		<>
			<Drawer name="worldInfo" title={t('sidebars.worldInfoTitle')}>
				<Stack gap="md">
					<input
						type="file"
						ref={fileInputRef}
						style={{ display: 'none' }}
						accept=".json,.png"
						onChange={handleFileChange}
					/>

					<Group gap="sm" wrap={isMobile ? 'wrap' : 'nowrap'} align="flex-end" className="ts-sidebar-toolbar">
						<Select
							data={bookOptions}
							value={selectedId}
							onChange={(id) => worldInfoBookSelected(id ?? null)}
							placeholder={t('sidebars.selectWorldInfoBook')}
							comboboxProps={{ withinPortal: false }}
							className="ts-sidebar-toolbar__main"
							style={isMobile ? { minWidth: '100%' } : undefined}
						/>

						<Group gap="xs" wrap="nowrap" className="ts-sidebar-toolbar__actions">
							<IconButtonWithTooltip tooltip={t('common.create')} icon={<PlusIcon />} aria-label={t('worldInfo.actions.createBook')} onClick={() => worldInfoBookCreateRequested()} />
							<IconButtonWithTooltip
								tooltip={t('common.duplicate')}
								icon={<CopyIcon />}
								aria-label={t('worldInfo.actions.duplicateBook')}
								disabled={!selectedId}
								onClick={() => {
									if (!selectedId) return;
									worldInfoBookDuplicateRequested({ id: selectedId });
								}}
							/>
							<IconButtonWithTooltip tooltip={t('common.import')} icon={<IMPORT_FILE_ICON />} aria-label={t('worldInfo.actions.importBook')} onClick={() => fileInputRef.current?.click()} />
							<IconButtonWithTooltip tooltip={t('common.export')} icon={<EXPORT_FILE_ICON />} aria-label={t('worldInfo.actions.exportBook')} disabled={!selectedId} onClick={() => void handleExport()} />
							<IconButtonWithTooltip
								tooltip={t('worldInfo.actions.openEditor')}
								icon={<PencilSimpleIcon />}
								aria-label={t('worldInfo.actions.openEditor')}
								disabled={!selectedBook}
								onClick={() => setEditorOpen(true)}
							/>
							<IconButtonWithTooltip
								tooltip={t('common.refresh')}
								icon={<ArrowsClockwiseIcon />}
								aria-label={t('worldInfo.actions.refresh')}
								onClick={() => {
									void loadWorldInfoBooksFx();
									void loadWorldInfoSettingsFx();
									void loadWorldInfoGlobalBindingsFx();
								}}
							/>
							<IconButtonWithTooltip
								tooltip={t('common.delete')}
								icon={<TrashIcon />}
								aria-label={t('worldInfo.actions.deleteBook')}
								color="red"
								variant="outline"
								disabled={!selectedId}
								onClick={() => {
									if (!selectedId) return;
									if (!window.confirm(t('worldInfo.confirm.deleteBook'))) return;
									worldInfoBookDeleteRequested({ id: selectedId });
									setEditorOpen(false);
								}}
							/>
						</Group>
					</Group>

					<Paper withBorder p="md" radius="md">
						<Stack gap="sm">
							<Text size="sm" fw={600}>
								{t('worldInfo.globalBinding.title')}
							</Text>
							<Select
								label={t('worldInfo.globalBinding.label')}
								value={globalBookId ?? '__none__'}
								data={globalBindingOptions}
								disabled={isBusy}
								comboboxProps={{ withinPortal: false }}
								onChange={(value) =>
									setWorldInfoBookBoundToGlobalRequested({
										bookId: value === '__none__' ? null : value ?? null,
									})
								}
							/>
							{globalBoundBook ? (
								<Stack gap={4}>
									<Text size="sm" fw={600}>
										{globalBoundBook.name}
									</Text>
									<Text size="xs" c="dimmed">
										slug: {globalBoundBook.slug}
									</Text>
								</Stack>
							) : (
								<Text size="sm" c="dimmed">
									{t('worldInfo.globalBinding.notBound')}
								</Text>
							)}
						</Stack>
					</Paper>

					{!selectedBook ? (
						<Text c="dimmed" size="sm">{t('sidebars.selectBookToEdit')}</Text>
					) : (
						<Stack gap="sm">
							<Text size="sm" fw={600}>{selectedBook.name}</Text>
							<Text size="xs" c="dimmed">slug: {selectedBook.slug}</Text>
							{selectedBook.description && <Text size="sm" c="dimmed">{selectedBook.description}</Text>}

							<Button leftSection={<PencilSimpleIcon />} onClick={() => setEditorOpen(true)}>
								{t('worldInfo.actions.openEditor')}
							</Button>
						</Stack>
					)}

					<Accordion variant="separated">
						<Accordion.Item value="world-info-settings">
							<Accordion.Control>{t('worldInfo.settings.title')}</Accordion.Control>
							<Accordion.Panel>
								<WorldInfoSettingsPanel
									settingsDraft={settingsDraft}
									isBusy={isBusy}
									isSaveSettingsPending={isSaveSettingsPending}
									onDraftChange={setSettingsDraft}
									onSave={handleSaveSettings}
								/>
							</Accordion.Panel>
						</Accordion.Item>
					</Accordion>
				</Stack>
			</Drawer>

			<WorldInfoEditorModal
				opened={editorOpen}
				book={selectedBook}
				saving={isSaveBookPending}
				onClose={() => setEditorOpen(false)}
				onSave={(payload) => worldInfoBookSaveRequested(payload)}
			/>
		</>
	);
};
