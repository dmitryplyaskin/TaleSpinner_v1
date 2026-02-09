import { Accordion, Button, Group, NumberInput, Select, Stack, Switch, Text, TextInput, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuCopy, LuDownload, LuPlus, LuRefreshCw, LuTrash2, LuUpload } from 'react-icons/lu';

import { $currentChat } from '@model/chat-core';
import {
	$isWorldInfoBookBoundToCurrentChat,
	$selectedWorldInfoBook,
	$selectedWorldInfoBookId,
	$worldInfoBooks,
	$worldInfoSettings,
	createWorldInfoBookFx,
	deleteWorldInfoBookFx,
	duplicateWorldInfoBookFx,
	importWorldInfoBookFx,
	loadWorldInfoBooksFx,
	loadWorldInfoChatBindingsFx,
	loadWorldInfoSettingsFx,
	saveWorldInfoBookFx,
	saveWorldInfoSettingsFx,
	worldInfoBookBindingToggleRequested,
	worldInfoBookCreateRequested,
	worldInfoBookDeleteRequested,
	worldInfoBookDuplicateRequested,
	worldInfoBookSaveRequested,
	worldInfoBookSelected,
	worldInfoImportBookRequested,
	worldInfoSettingsSaveRequested,
} from '@model/world-info';
import { Drawer } from '@ui/drawer';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import { exportWorldInfoBookToStNative, type WorldInfoSettingsDto } from '../../../api/world-info';

function parseNumberInput(value: string | number, fallback: number): number {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	return fallback;
}

function serializeBookData(data: unknown): string {
	return JSON.stringify(data ?? { entries: {} }, null, 2);
}

const EMPTY_BOOK_DATA_JSON = `{
  "entries": {}
}`;

export const WorldInfoSidebar = () => {
	const { t } = useTranslation();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const [books, selectedId, selectedBook, settings, isBoundToCurrentChat, currentChat] = useUnit([
		$worldInfoBooks,
		$selectedWorldInfoBookId,
		$selectedWorldInfoBook,
		$worldInfoSettings,
		$isWorldInfoBookBoundToCurrentChat,
		$currentChat,
	]);

	const [draftName, setDraftName] = useState('');
	const [draftSlug, setDraftSlug] = useState('');
	const [draftDescription, setDraftDescription] = useState('');
	const [draftData, setDraftData] = useState(EMPTY_BOOK_DATA_JSON);
	const [draftVersion, setDraftVersion] = useState(1);
	const [settingsDraft, setSettingsDraft] = useState<Partial<WorldInfoSettingsDto> | null>(null);

	useEffect(() => {
		if (!selectedBook) {
			setDraftName('');
			setDraftSlug('');
			setDraftDescription('');
			setDraftData(EMPTY_BOOK_DATA_JSON);
			setDraftVersion(1);
			return;
		}
		setDraftName(selectedBook.name);
		setDraftSlug(selectedBook.slug);
		setDraftDescription(selectedBook.description ?? '');
		setDraftData(serializeBookData(selectedBook.data));
		setDraftVersion(selectedBook.version);
	}, [selectedBook]);

	useEffect(() => {
		if (!settings) {
			setSettingsDraft(null);
			return;
		}
		setSettingsDraft({
			scanDepth: settings.scanDepth,
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

	const handleSaveBook = () => {
		if (!selectedBook) return;
		if (!draftName.trim()) {
			toaster.error({ title: t('worldInfo.toasts.bookNameRequired') });
			return;
		}

		let parsedData: unknown;
		try {
			parsedData = JSON.parse(draftData);
		} catch (error) {
			toaster.error({
				title: t('worldInfo.toasts.invalidBookJson'),
				description: error instanceof Error ? error.message : String(error),
			});
			return;
		}

		worldInfoBookSaveRequested({
			id: selectedBook.id,
			name: draftName.trim(),
			slug: draftSlug.trim(),
			description: draftDescription.trim() || null,
			data: parsedData,
			version: draftVersion,
		});
	};

	const handleSaveSettings = () => {
		if (!settingsDraft) return;
		worldInfoSettingsSaveRequested({
			patch: {
				scanDepth: settingsDraft.scanDepth,
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
		<Drawer name="worldInfo" title={t('sidebars.worldInfoTitle')}>
			<Stack gap="md">
				<input
					type="file"
					ref={fileInputRef}
					style={{ display: 'none' }}
					accept=".json,.png"
					onChange={handleFileChange}
				/>

				<Group gap="sm" wrap="nowrap" align="flex-end" className="ts-sidebar-toolbar">
					<Select
						data={bookOptions}
						value={selectedId}
						onChange={(id) => worldInfoBookSelected(id ?? null)}
						placeholder={t('sidebars.selectWorldInfoBook')}
						comboboxProps={{ withinPortal: false }}
						className="ts-sidebar-toolbar__main"
					/>

					<Group gap="xs" wrap="nowrap" className="ts-sidebar-toolbar__actions">
						<IconButtonWithTooltip
							tooltip={t('common.create')}
							icon={<LuPlus />}
							aria-label={t('worldInfo.actions.createBook')}
							onClick={() => worldInfoBookCreateRequested()}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.duplicate')}
							icon={<LuCopy />}
							aria-label={t('worldInfo.actions.duplicateBook')}
							disabled={!selectedId}
							onClick={() => {
								if (!selectedId) return;
								worldInfoBookDuplicateRequested({ id: selectedId });
							}}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.import')}
							icon={<LuUpload />}
							aria-label={t('worldInfo.actions.importBook')}
							onClick={() => fileInputRef.current?.click()}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.export')}
							icon={<LuDownload />}
							aria-label={t('worldInfo.actions.exportBook')}
							disabled={!selectedId}
							onClick={() => void handleExport()}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.refresh')}
							icon={<LuRefreshCw />}
							aria-label={t('worldInfo.actions.refresh')}
							onClick={() => {
								void loadWorldInfoBooksFx();
								void loadWorldInfoSettingsFx();
								if (currentChat?.id) {
									void loadWorldInfoChatBindingsFx({ chatId: currentChat.id });
								}
							}}
						/>
						<IconButtonWithTooltip
							tooltip={t('common.delete')}
							icon={<LuTrash2 />}
							aria-label={t('worldInfo.actions.deleteBook')}
							color="red"
							variant="outline"
							disabled={!selectedId}
							onClick={() => {
								if (!selectedId) return;
								if (!window.confirm(t('worldInfo.confirm.deleteBook'))) return;
								worldInfoBookDeleteRequested({ id: selectedId });
							}}
						/>
					</Group>
				</Group>

				{!selectedBook ? (
					<Text c="dimmed" size="sm">
						{t('sidebars.selectBookToEdit')}
					</Text>
				) : (
					<Stack gap="sm">
						<TextInput label={t('worldInfo.fields.name')} value={draftName} onChange={(e) => setDraftName(e.currentTarget.value)} />
						<TextInput label={t('worldInfo.fields.slug')} value={draftSlug} onChange={(e) => setDraftSlug(e.currentTarget.value)} />
						<TextInput
							label={t('worldInfo.fields.description')}
							value={draftDescription}
							onChange={(e) => setDraftDescription(e.currentTarget.value)}
						/>
						<Textarea
							label={t('worldInfo.fields.bookDataJson')}
							value={draftData}
							onChange={(e) => setDraftData(e.currentTarget.value)}
							minRows={14}
							autosize
						/>

						<Switch
							label={
								currentChat
									? t('worldInfo.fields.bindToChat', { chatTitle: currentChat.title })
									: t('worldInfo.fields.noActiveChat')
							}
							checked={isBoundToCurrentChat}
							disabled={!currentChat}
							onChange={(e) =>
								worldInfoBookBindingToggleRequested({
									bookId: selectedBook.id,
									enabled: e.currentTarget.checked,
								})
							}
						/>

						<Button onClick={handleSaveBook} loading={isSaveBookPending} disabled={isBusy}>
							{t('worldInfo.actions.saveBook')}
						</Button>
					</Stack>
				)}

				<Accordion variant="separated">
					<Accordion.Item value="world-info-settings">
						<Accordion.Control>{t('worldInfo.settings.title')}</Accordion.Control>
						<Accordion.Panel>
							{!settingsDraft ? (
								<Text size="sm" c="dimmed">
									{t('worldInfo.settings.notLoaded')}
								</Text>
							) : (
								<Stack gap="sm">
									<NumberInput
										label={t('worldInfo.settings.scanDepth')}
										min={0}
										value={settingsDraft.scanDepth ?? 0}
										onChange={(value) =>
											setSettingsDraft((prev) => ({
												...(prev ?? {}),
												scanDepth: parseNumberInput(value, 0),
											}))
										}
									/>
									<NumberInput
										label={t('worldInfo.settings.budgetPercent')}
										min={1}
										max={100}
										value={settingsDraft.budgetPercent ?? 25}
										onChange={(value) =>
											setSettingsDraft((prev) => ({
												...(prev ?? {}),
												budgetPercent: parseNumberInput(value, 25),
											}))
										}
									/>
									<NumberInput
										label={t('worldInfo.settings.budgetCapTokens')}
										min={0}
										value={settingsDraft.budgetCapTokens ?? 0}
										onChange={(value) =>
											setSettingsDraft((prev) => ({
												...(prev ?? {}),
												budgetCapTokens: parseNumberInput(value, 0),
											}))
										}
									/>
									<NumberInput
										label={t('worldInfo.settings.contextWindowTokens')}
										min={1}
										value={settingsDraft.contextWindowTokens ?? 8192}
										onChange={(value) =>
											setSettingsDraft((prev) => ({
												...(prev ?? {}),
												contextWindowTokens: parseNumberInput(value, 8192),
											}))
										}
									/>
									<Switch
										label={t('worldInfo.settings.recursive')}
										checked={Boolean(settingsDraft.recursive)}
										onChange={(e) =>
											setSettingsDraft((prev) => ({ ...(prev ?? {}), recursive: e.currentTarget.checked }))
										}
									/>
									<Switch
										label={t('worldInfo.settings.includeNames')}
										checked={Boolean(settingsDraft.includeNames)}
										onChange={(e) =>
											setSettingsDraft((prev) => ({ ...(prev ?? {}), includeNames: e.currentTarget.checked }))
										}
									/>
									<Switch
										label={t('worldInfo.settings.caseSensitive')}
										checked={Boolean(settingsDraft.caseSensitive)}
										onChange={(e) =>
											setSettingsDraft((prev) => ({ ...(prev ?? {}), caseSensitive: e.currentTarget.checked }))
										}
									/>
									<Switch
										label={t('worldInfo.settings.matchWholeWords')}
										checked={Boolean(settingsDraft.matchWholeWords)}
										onChange={(e) =>
											setSettingsDraft((prev) => ({ ...(prev ?? {}), matchWholeWords: e.currentTarget.checked }))
										}
									/>
									<Switch
										label={t('worldInfo.settings.useGroupScoring')}
										checked={Boolean(settingsDraft.useGroupScoring)}
										onChange={(e) =>
											setSettingsDraft((prev) => ({ ...(prev ?? {}), useGroupScoring: e.currentTarget.checked }))
										}
									/>
									<Button onClick={handleSaveSettings} loading={isSaveSettingsPending} disabled={isBusy}>
										{t('worldInfo.actions.saveSettings')}
									</Button>
								</Stack>
							)}
						</Accordion.Panel>
					</Accordion.Item>
				</Accordion>
			</Stack>
		</Drawer>
	);
};
