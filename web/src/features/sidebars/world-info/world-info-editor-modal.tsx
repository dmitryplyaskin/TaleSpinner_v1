import { Accordion, Button, Divider, Group, Pagination, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FormProvider, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';


import { Dialog } from '@ui/dialog';
import { FormInput } from '@ui/form-components';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { PlusIcon } from '@ui/icons';
import { toaster } from '@ui/toaster';

import {
	DEFAULT_PAGE_SIZE,
	PAGE_SIZE_OPTIONS,
	buildDraft,
	cloneEntryState,
	createEmptyEntryState,
	getEntrySearchText,
	nextEntryId,
	resolveEntryPage,
	toEntryPayload,
	type BookDraft,
	type EntryState,
} from './world-info-editor-shared';
import { WorldInfoEntryItem } from './world-info-entry-item';

import type { WorldInfoBookDto } from '../../../api/world-info';

type Props = {
	opened: boolean;
	book: WorldInfoBookDto | null;
	saving: boolean;
	onClose: () => void;
	onSave: (payload: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		data: unknown;
		version: number;
	}) => void;
};

export const WorldInfoEditorModal = ({ opened, book, saving, onClose, onSave }: Props) => {
	const { t } = useTranslation();
	const isMobile = useMediaQuery('(max-width: 48em)');

	const methods = useForm<BookDraft>({
		defaultValues: {
			id: '',
			name: '',
			slug: '',
			description: '',
			version: 0,
			entries: [],
		},
	});
	const {
		control,
		getValues,
		reset,
		formState: { isDirty },
	} = methods;
	const { fields, append, remove, move } = useFieldArray({
		control,
		name: 'entries',
		keyName: '_key',
	});

	const [expandedEntryIds, setExpandedEntryIds] = useState<string[]>([]);
	const [search, setSearch] = useState('');
	const [currentPage, setCurrentPage] = useState(1);
	const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

	useEffect(() => {
		if (!opened || !book) return;
		const next = buildDraft(book);
		reset(next);
		setExpandedEntryIds(next.entries[0] ? [next.entries[0].id] : []);
		setSearch('');
		setCurrentPage(1);
		setPageSize(DEFAULT_PAGE_SIZE);
	}, [book, opened, reset]);

	const entryIds = useMemo(() => fields.map((field) => String(field.id)), [fields]);
	const entryIndexById = useMemo(() => {
		const map = new Map<string, number>();
		entryIds.forEach((id, index) => {
			map.set(id, index);
		});
		return map;
	}, [entryIds]);

	useEffect(() => {
		setExpandedEntryIds((prev) => {
			const ids = new Set(entryIds);
			const next = prev.filter((id) => ids.has(id));
			if (next.length === prev.length && next.every((value, index) => value === prev[index])) {
				return prev;
			}
			return next;
		});
	}, [entryIds]);

	const query = search.trim().toLowerCase();
	const searchWatchPaths = useMemo(
		() =>
			fields.flatMap((_, index) => [
				`entries.${index}.id`,
				`entries.${index}.draft.comment`,
				`entries.${index}.draft.content`,
				`entries.${index}.draft.key`,
				`entries.${index}.draft.keysecondary`,
			]),
		[fields],
	);
	const searchWatchValues = useWatch({
		control,
		name: searchWatchPaths as any,
		disabled: query.length === 0,
	}) as unknown[] | undefined;

	const visibleEntryIndexes = useMemo(() => {
		if (query.length === 0) {
			return fields.map((_, index) => index);
		}

		return fields
			.map((_, index) => {
				const base = index * 5;
				const watchedId = searchWatchValues?.[base];
				const watchedComment = searchWatchValues?.[base + 1];
				const watchedContent = searchWatchValues?.[base + 2];
				const watchedKey = searchWatchValues?.[base + 3];
				const watchedKeySecondary = searchWatchValues?.[base + 4];

				const snapshot = getValues(`entries.${index}` as const);
				const searchText = getEntrySearchText({
					id: typeof watchedId === 'string' ? watchedId : String(snapshot?.id ?? fields[index]?.id ?? ''),
					comment: typeof watchedComment === 'string' ? watchedComment : snapshot?.draft?.comment ?? '',
					content: typeof watchedContent === 'string' ? watchedContent : snapshot?.draft?.content ?? '',
					key: Array.isArray(watchedKey)
						? watchedKey.filter((item): item is string => typeof item === 'string')
						: snapshot?.draft?.key ?? [],
					keysecondary: Array.isArray(watchedKeySecondary)
						? watchedKeySecondary.filter((item): item is string => typeof item === 'string')
						: snapshot?.draft?.keysecondary ?? [],
				});

				return searchText.includes(query) ? index : -1;
			})
			.filter((index): index is number => index >= 0);
	}, [fields, getValues, query, searchWatchValues]);

	const totalItems = visibleEntryIndexes.length;
	const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
	const paginatedEntryIndexes = useMemo(() => {
		const start = (currentPage - 1) * pageSize;
		return visibleEntryIndexes.slice(start, start + pageSize);
	}, [currentPage, pageSize, visibleEntryIndexes]);

	useEffect(() => {
		setCurrentPage((prev) => Math.min(Math.max(prev, 1), totalPages));
	}, [totalPages]);

	const requestClose = () => {
		if (saving) return;
		if (isDirty && !window.confirm(t('worldInfo.confirm.discardChanges'))) return;
		onClose();
	};

	const addEntry = useCallback(() => {
		setSearch('');
		const currentEntries = getValues('entries') ?? [];
		const id = nextEntryId(currentEntries);
		append(createEmptyEntryState(id, currentEntries.length));
		setExpandedEntryIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
		setCurrentPage(Math.floor(currentEntries.length / pageSize) + 1);
	}, [append, getValues, pageSize]);

	const duplicateEntry = useCallback(
		(entryId: string) => {
			setSearch('');
			const sourceIndex = entryIndexById.get(entryId);
			if (sourceIndex === undefined) return;
			const source = getValues(`entries.${sourceIndex}` as const);
			if (!source) return;
			const currentEntries = getValues('entries') ?? [];
			const id = nextEntryId(currentEntries);
			append(cloneEntryState(source as EntryState, id));
			setExpandedEntryIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
			setCurrentPage(Math.floor(currentEntries.length / pageSize) + 1);
		},
		[append, entryIndexById, getValues, pageSize],
	);

	const deleteEntry = useCallback(
		(entryId: string) => {
			const index = entryIndexById.get(entryId);
			if (index === undefined) return;
			const currentEntries = getValues('entries') ?? [];
			const nextEntries = currentEntries.filter((entry) => entry.id !== entryId);
			remove(index);
			setExpandedEntryIds((prev) => prev.filter((id) => id !== entryId));
			const nextTotalPages = Math.max(1, Math.ceil(nextEntries.length / pageSize));
			setCurrentPage((prev) => Math.min(prev, nextTotalPages));
		},
		[entryIndexById, getValues, pageSize, remove],
	);

	const moveEntryById = useCallback(
		(entryId: string, direction: 'up' | 'down') => {
			const index = entryIndexById.get(entryId);
			if (index === undefined) return;
			const currentEntries = getValues('entries') ?? [];
			if (direction === 'up' && index === 0) return;
			if (direction === 'down' && index === currentEntries.length - 1) return;
			const targetIndex = direction === 'up' ? index - 1 : index + 1;
			const nextEntries = currentEntries.slice();
			const temp = nextEntries[targetIndex];
			nextEntries[targetIndex] = nextEntries[index];
			nextEntries[index] = temp;
			move(index, targetIndex);
			const nextPage = resolveEntryPage(nextEntries, search, pageSize, entryId);
			if (nextPage) setCurrentPage(nextPage);
		},
		[entryIndexById, getValues, move, pageSize, search],
	);

	const save = () => {
		if (!book) return;
		const currentDraft = getValues();
		if (!currentDraft.name.trim()) {
			toaster.error({ title: t('worldInfo.toasts.bookNameRequired') });
			return;
		}

		try {
			const entriesPayload = Object.fromEntries((currentDraft.entries ?? []).map((entry) => [entry.id, toEntryPayload(entry)]));
			onSave({
				id: currentDraft.id,
				name: currentDraft.name.trim(),
				slug: currentDraft.slug.trim(),
				description: currentDraft.description.trim() || null,
				data: { entries: entriesPayload },
				version: currentDraft.version,
			});
			reset(currentDraft);
		} catch (error) {
			toaster.error({
				title: t('worldInfo.toasts.invalidBookJson'),
				description: error instanceof Error ? error.message : String(error),
			});
		}
	};

	return (
		<Dialog
			open={opened}
			onOpenChange={(open) => {
				if (!open) requestClose();
			}}
			title={t('worldInfo.editor.title')}
			size="cover"
			fullScreenContentMaxWidth={isMobile ? undefined : 1500}
			fillBodyHeight
			footer={
				<>
					<Button variant="subtle" disabled={saving} onClick={requestClose}>
						{t('common.cancel')}
					</Button>
					<Button loading={saving} onClick={save}>
						{t('common.save')}
					</Button>
				</>
			}
		>
			<FormProvider {...methods}>
				{!book ? (
					<Text c="dimmed">{t('sidebars.selectBookToEdit')}</Text>
				) : (
					<Stack gap="sm" style={{ flex: 1, minHeight: 0 }}>
						<Group grow align="end" wrap={isMobile ? 'wrap' : 'nowrap'}>
							<FormInput name="name" label={t('worldInfo.fields.name')} />
							<FormInput name="slug" label={t('worldInfo.fields.slug')} />
							<FormInput name="description" label={t('worldInfo.fields.description')} />
						</Group>

						<Divider />

						<Group justify="space-between" align="center">
							<Text fw={600}>{t('worldInfo.editor.entriesTitle')}</Text>
							<IconButtonWithTooltip icon={<PlusIcon />} tooltip={t('worldInfo.editor.addEntry')} aria-label={t('worldInfo.editor.addEntry')} onClick={addEntry} />
						</Group>

						<Group grow align="end" wrap={isMobile ? 'wrap' : 'nowrap'}>
							<TextInput
								label={t('worldInfo.editor.searchEntries')}
								value={search}
								onChange={(event) => {
									setSearch(event.currentTarget.value);
									setCurrentPage(1);
								}}
							/>
							<Select
								label={t('worldInfo.editor.pageSizeLabel')}
								value={String(pageSize)}
								data={PAGE_SIZE_OPTIONS}
								onChange={(value) => {
									const nextPageSize = Number(value ?? DEFAULT_PAGE_SIZE);
									setPageSize(nextPageSize);
									setCurrentPage(1);
								}}
								comboboxProps={{ withinPortal: false }}
							/>
						</Group>

						<Group justify="space-between" align="center" wrap="nowrap">
							{totalItems > pageSize ? <Pagination total={totalPages} value={currentPage} onChange={setCurrentPage} withEdges /> : <div />}
							<Text size="sm" c="dimmed" style={{ marginLeft: 'auto' }}>
								{t('worldInfo.editor.shownOfTotal', { shown: paginatedEntryIndexes.length, total: totalItems })}
							</Text>
						</Group>

						<ScrollArea style={{ flex: 1 }}>
							{paginatedEntryIndexes.length === 0 ? (
								<Text c="dimmed" size="sm">
									{query.length > 0 ? t('worldInfo.editor.noSearchResults') : t('worldInfo.editor.noEntries')}
								</Text>
							) : (
								<Accordion multiple value={expandedEntryIds} onChange={setExpandedEntryIds} variant="separated">
									{paginatedEntryIndexes.map((index) => {
										const field = fields[index];
										if (!field) return null;
										const entryId = String(field.id);
										const rowKey = typeof (field as { _key?: unknown })._key === 'string' ? ((field as { _key: string })._key) : `${entryId}-${index}`;
										return (
											<WorldInfoEntryItem
												key={rowKey}
												index={index}
												entryId={entryId}
												canMoveUp={index > 0}
												canMoveDown={index < fields.length - 1}
												isExpanded={expandedEntryIds.includes(entryId)}
												onMove={moveEntryById}
												onDuplicate={duplicateEntry}
												onDelete={deleteEntry}
											/>
										);
									})}
								</Accordion>
							)}
						</ScrollArea>
					</Stack>
				)}
			</FormProvider>
		</Dialog>
	);
};
