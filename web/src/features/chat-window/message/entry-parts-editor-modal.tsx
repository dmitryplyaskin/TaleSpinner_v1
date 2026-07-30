import { ActionIcon, Alert, Button, Group, Modal, Paper, ScrollArea, Select, Stack, Switch, Text, Textarea } from '@mantine/core';
import { useUnit } from 'effector-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
	$entries,
	$entryPartsEditorState,
	batchUpdateEntryPartsFx,
	closeEntryPartsEditorRequested,
	saveEntryPartsEditorRequested,
} from '@model/chat-entry-parts';
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, StarIcon, TrashIcon } from '@ui/icons';


import {
	buildEntryPartsEditorRequestParts,
	createDraftPartFromSource,
	createNewDraftPart,
	isTextLikeDraftPart,
	resolveFallbackMainPartId,
	sortPartsStable,
	type DraftPartState,
} from './entry-parts-editor-state';

import type { Part } from '@shared/types/chat-entry-parts';

const CHANNEL_OPTIONS: Array<{ value: Part['channel']; label: string }> = [
	{ value: 'aux', label: 'aux' },
	{ value: 'reasoning', label: 'reasoning' },
	{ value: 'trace', label: 'trace' },
];

const FORMAT_OPTIONS: Array<{ value: Part['payloadFormat']; label: string }> = [
	{ value: 'markdown', label: 'markdown' },
	{ value: 'text', label: 'text' },
	{ value: 'json', label: 'json' },
];

export const EntryPartsEditorModal = () => {
	const { t } = useTranslation();
	const [entries, entryPartsEditorState, closeEntryPartsEditor, saveEntryPartsEditor, partsEditorSaving] = useUnit([
		$entries,
		$entryPartsEditorState,
		closeEntryPartsEditorRequested,
		saveEntryPartsEditorRequested,
		batchUpdateEntryPartsFx.pending,
	]);
	const [draftParts, setDraftParts] = useState<DraftPartState[]>([]);
	const [removedPartIds, setRemovedPartIds] = useState<string[]>([]);
	const [mainPartId, setMainPartId] = useState<string>('');

	const editedEntry = useMemo(() => {
		if (!entryPartsEditorState.entryId) return null;
		return entries.find((item) => item.entry.entryId === entryPartsEditorState.entryId) ?? null;
	}, [entries, entryPartsEditorState.entryId]);
	const sourceParts = useMemo(
		() =>
			(editedEntry?.variant?.parts ?? [])
				.filter((part) => !part.softDeleted)
				.slice()
				.sort(sortPartsStable),
		[editedEntry?.variant?.parts],
	);
	const sourcePartById = useMemo(() => new Map(sourceParts.map((part) => [part.partId, part] as const)), [sourceParts]);
	const removedParts = useMemo(
		() => removedPartIds.map((partId) => sourcePartById.get(partId)).filter((part): part is Part => Boolean(part)),
		[removedPartIds, sourcePartById],
	);

	useEffect(() => {
		if (!entryPartsEditorState.open) return;
		const nextDraft = sourceParts.map(createDraftPartFromSource);
		setDraftParts(nextDraft);
		setRemovedPartIds([]);
		const fallbackMain =
			nextDraft.find((part) => part.channel === 'main' && isTextLikeDraftPart(part)) ??
			nextDraft.find(isTextLikeDraftPart) ??
			nextDraft[0] ??
			null;
		setMainPartId(fallbackMain?.id ?? '');
	}, [entryPartsEditorState.open, sourceParts]);

	const jsonInvalidPartIds = useMemo(() => {
		const invalid = new Set<string>();
		for (const part of draftParts) {
			if (part.payloadFormat !== 'json') continue;
			try {
				JSON.parse(part.payloadRaw);
			} catch {
				invalid.add(part.id);
			}
		}
		return invalid;
	}, [draftParts]);
	const mainDraftPart = useMemo(() => draftParts.find((part) => part.id === mainPartId) ?? null, [draftParts, mainPartId]);
	const mainPartValid = Boolean(mainDraftPart && isTextLikeDraftPart(mainDraftPart));
	const canSavePartsEditor =
		entryPartsEditorState.open &&
		Boolean(editedEntry?.variant) &&
		draftParts.length > 0 &&
		mainPartValid &&
		jsonInvalidPartIds.size === 0 &&
		!partsEditorSaving;

	const updateDraftPart = (partId: string, updater: (part: DraftPartState) => DraftPartState) => {
		setDraftParts((prev) => prev.map((part) => (part.id === partId ? updater(part) : part)));
	};

	const movePart = (partId: string, direction: 'up' | 'down') => {
		setDraftParts((prev) => {
			const fromIndex = prev.findIndex((part) => part.id === partId);
			if (fromIndex < 0) return prev;
			if (direction === 'up' && fromIndex === 0) return prev;
			if (direction === 'down' && fromIndex === prev.length - 1) return prev;
			const targetIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1;
			const next = prev.slice();
			const tmp = next[targetIndex];
			next[targetIndex] = next[fromIndex] as DraftPartState;
			next[fromIndex] = tmp as DraftPartState;
			return next;
		});
	};

	const removePart = (partId: string) => {
		setDraftParts((prev) => {
			const next = prev.filter((part) => part.id !== partId);
			if (mainPartId === partId) setMainPartId(resolveFallbackMainPartId(next));
			return next;
		});
		if (sourcePartById.has(partId)) {
			setRemovedPartIds((prev) => (prev.includes(partId) ? prev : [...prev, partId]));
		}
	};

	const addPart = () => {
		setDraftParts((prev) => {
			const nextPart = createNewDraftPart(prev.length + 1);
			if (prev.length === 0) setMainPartId(nextPart.id);
			return [...prev, nextPart];
		});
	};

	const savePartsEditorChanges = () => {
		if (!editedEntry?.variant) return;
		if (!canSavePartsEditor) return;
		try {
			saveEntryPartsEditor({
				entryId: editedEntry.entry.entryId,
				variantId: editedEntry.variant.variantId,
				mainPartId,
				orderedPartIds: draftParts.map((part) => part.id),
				parts: buildEntryPartsEditorRequestParts({ draftParts, removedParts }),
			});
		} catch {
			return;
		}
	};

	return (
		<Modal
			opened={entryPartsEditorState.open}
			onClose={() => {
				if (partsEditorSaving) return;
				closeEntryPartsEditor();
			}}
			title={t('chat.partsEditor.title')}
			centered
			size="xl"
			closeOnClickOutside={!partsEditorSaving}
			closeOnEscape={!partsEditorSaving}
		>
			<Stack gap="sm">
				{!editedEntry?.variant && (
					<Text size="sm" c="dimmed">
						{t('chat.partsEditor.empty')}
					</Text>
				)}
				{editedEntry?.variant && (
					<>
						{draftParts.length === 0 && (
							<Alert color="red" variant="light">
								{t('chat.partsEditor.validation.noParts')}
							</Alert>
						)}
						{!mainPartValid && (
							<Alert color="red" variant="light">
								{t('chat.partsEditor.validation.mainPart')}
							</Alert>
						)}
						{jsonInvalidPartIds.size > 0 && (
							<Alert color="red" variant="light">
								{t('chat.partsEditor.validation.json')}
							</Alert>
						)}
						<Group justify="flex-end">
							<Button size="xs" variant="light" leftSection={<PlusIcon size={14} />} onClick={addPart}>
								{t('chat.partsEditor.actions.addPart')}
							</Button>
						</Group>
						<ScrollArea.Autosize mah={460}>
							<Stack gap="xs">
								{draftParts.map((part, index) => {
									const isMain = part.id === mainPartId;
									const canSelectAsMain = isTextLikeDraftPart(part);
									const isJsonInvalid = part.payloadFormat === 'json' && jsonInvalidPartIds.has(part.id);
									return (
										<Paper key={part.id} withBorder radius="sm" p="sm">
											<Stack gap="xs">
												<Group justify="space-between" align="flex-start" wrap="nowrap">
													<Stack gap={0}>
														<Text size="sm" fw={600}>
															{part.partId ?? part.clientPartId}
														</Text>
														<Text size="xs" c="dimmed">
															{t('chat.partsEditor.meta.source')}: {part.source}
														</Text>
														{part.replacesPartId && (
															<Text size="xs" c="dimmed">
																{t('chat.partsEditor.meta.replaces')}: {part.replacesPartId}
															</Text>
														)}
													</Stack>
													<Group gap={6} align="center" wrap="nowrap">
														<ActionIcon
															variant="subtle"
															onClick={() => movePart(part.id, 'up')}
															disabled={index <= 0}
															aria-label={t('chat.partsEditor.actions.moveUp')}
														>
															<ArrowUpIcon size={14} />
														</ActionIcon>
														<ActionIcon
															variant="subtle"
															onClick={() => movePart(part.id, 'down')}
															disabled={index >= draftParts.length - 1}
															aria-label={t('chat.partsEditor.actions.moveDown')}
														>
															<ArrowDownIcon size={14} />
														</ActionIcon>
														<Button
															size="xs"
															variant={isMain ? 'filled' : 'light'}
															color={isMain ? 'yellow' : 'gray'}
															leftSection={<StarIcon size={12} />}
															disabled={!canSelectAsMain}
															onClick={() => setMainPartId(part.id)}
														>
															{isMain ? t('chat.partsEditor.actions.mainSelected') : t('chat.partsEditor.actions.makeMain')}
														</Button>
														<ActionIcon
															variant="subtle"
															color="red"
															onClick={() => removePart(part.id)}
															aria-label={t('chat.partsEditor.actions.removePart')}
														>
															<TrashIcon size={14} />
														</ActionIcon>
													</Group>
												</Group>
												<Stack gap="xs">
													<Group gap="md" wrap="wrap" align="flex-end">
														<Select
															size="xs"
															label={t('chat.partsEditor.fields.channel')}
															data={CHANNEL_OPTIONS}
															value={part.channel === 'main' ? 'aux' : part.channel}
															disabled={Boolean(part.partId)}
															style={{ flex: '1 1 180px', maxWidth: 240 }}
															onChange={(value) => {
																if (!value) return;
																updateDraftPart(part.id, (prev) => ({ ...prev, channel: value as Part['channel'] }));
															}}
														/>
														<Select
															size="xs"
															label={t('chat.partsEditor.fields.format')}
															data={FORMAT_OPTIONS}
															value={part.payloadFormat}
															disabled={Boolean(part.partId)}
															style={{ flex: '1 1 180px', maxWidth: 240 }}
															onChange={(value) => {
																if (!value) return;
																updateDraftPart(part.id, (prev) => ({ ...prev, payloadFormat: value as Part['payloadFormat'] }));
															}}
														/>
													</Group>
													<Group gap="xl" wrap="wrap" align="center">
														<Switch
															checked={part.visibilityUi === 'always'}
															label={t('chat.partsEditor.fields.showInUi')}
															onChange={(event) => {
																const checked = event.currentTarget.checked;
																updateDraftPart(part.id, (prev) => ({
																	...prev,
																	visibilityUi: checked ? 'always' : 'never',
																}));
															}}
														/>
														<Switch
															checked={part.visibilityPrompt}
															label={t('chat.partsEditor.fields.includeInPrompt')}
															onChange={(event) => {
																const checked = event.currentTarget.checked;
																updateDraftPart(part.id, (prev) => ({
																	...prev,
																	visibilityPrompt: checked,
																}));
															}}
														/>
													</Group>
												</Stack>
												<Textarea
													label={
														part.payloadFormat === 'json'
															? t('chat.partsEditor.fields.payloadJson')
															: t('chat.partsEditor.fields.payloadText')
													}
													value={part.payloadRaw}
													minRows={part.payloadFormat === 'json' ? 5 : 3}
													autosize
													onChange={(event) => {
														const value = event.currentTarget.value;
														updateDraftPart(part.id, (prev) => ({
															...prev,
															payloadRaw: value,
														}));
													}}
												/>
												{isJsonInvalid && (
													<Text size="xs" c="red">
														{t('chat.partsEditor.validation.jsonPart', { partId: part.id })}
													</Text>
												)}
											</Stack>
										</Paper>
									);
								})}
							</Stack>
						</ScrollArea.Autosize>
						<Group justify="flex-end">
							<Button variant="subtle" disabled={partsEditorSaving} onClick={() => closeEntryPartsEditor()}>
								{t('common.cancel')}
							</Button>
							<Button onClick={savePartsEditorChanges} loading={partsEditorSaving} disabled={!canSavePartsEditor}>
								{t('common.save')}
							</Button>
						</Group>
					</>
				)}
			</Stack>
		</Modal>
	);
};
