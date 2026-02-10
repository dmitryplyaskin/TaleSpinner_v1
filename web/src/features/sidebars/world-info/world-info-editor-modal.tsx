import { Button, Divider, Group, NumberInput, ScrollArea, Select, Stack, Switch, Tabs, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuArrowDown, LuArrowUp, LuCopy, LuPlus, LuTrash2 } from 'react-icons/lu';

import { Dialog } from '@ui/dialog';
import { IconButtonWithTooltip } from '@ui/icon-button-with-tooltip';
import { toaster } from '@ui/toaster';

import type { WorldInfoBookDto } from '../../../api/world-info';

type EntryDraft = {
	uid: number;
	comment: string;
	content: string;
	key: string[];
	keysecondary: string[];
	position: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
	order: number;
	depth: number;
	outletName: string;
	selective: boolean;
	selectiveLogic: 0 | 1 | 2 | 3;
	scanDepth: number | null;
	caseSensitive: boolean | null;
	matchWholeWords: boolean | null;
	useGroupScoring: boolean | null;
	matchPersonaDescription: boolean;
	matchCharacterDescription: boolean;
	matchCharacterPersonality: boolean;
	matchCharacterDepthPrompt: boolean;
	matchScenario: boolean;
	matchCreatorNotes: boolean;
	constant: boolean;
	disable: boolean;
	useProbability: boolean;
	probability: number;
	ignoreBudget: boolean;
	excludeRecursion: boolean;
	preventRecursion: boolean;
	delayUntilRecursion: number;
	group: string;
	groupOverride: boolean;
	groupWeight: number;
	sticky: number | null;
	cooldown: number | null;
	delay: number | null;
	triggers: string[];
	role: 0 | 1 | 2;
	automationId: string;
	characterFilter: {
		isExclude: boolean;
		names: string[];
		tags: string[];
	};
	extensionsJson: string;
};

type EntryState = {
	id: string;
	original: Record<string, unknown>;
	draft: EntryDraft;
};

type BookDraft = {
	id: string;
	name: string;
	slug: string;
	description: string;
	version: number;
	entries: EntryState[];
};

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

type NullableBoolSelect = 'inherit' | 'true' | 'false';

type EditorTab = 'content' | 'matching' | 'activation' | 'timing' | 'advanced';

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = ''): string {
	return typeof value === 'string' ? value : fallback;
}

function asStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

function asNumber(value: unknown, fallback: number): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
	return typeof value === 'boolean' ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function parseNullableBool(value: NullableBoolSelect): boolean | null {
	if (value === 'true') return true;
	if (value === 'false') return false;
	return null;
}

function toNullableBool(value: boolean | null): NullableBoolSelect {
	if (value === true) return 'true';
	if (value === false) return 'false';
	return 'inherit';
}

function normalizeEntry(raw: unknown, fallbackUid: number): EntryDraft {
	const source = isRecord(raw) ? raw : {};
	const filter = isRecord(source.characterFilter) ? source.characterFilter : {};
	let extensionsJson = '{}';
	try {
		extensionsJson = JSON.stringify(isRecord(source.extensions) ? source.extensions : {}, null, 2);
	} catch {
		extensionsJson = '{}';
	}

	return {
		uid: Math.max(0, asNumber(source.uid, fallbackUid)),
		comment: asString(source.comment),
		content: asString(source.content),
		key: asStringArray(source.key),
		keysecondary: asStringArray(source.keysecondary),
		position: asNumber(source.position, 0) as EntryDraft['position'],
		order: asNumber(source.order, 100),
		depth: Math.max(0, asNumber(source.depth, 4)),
		outletName: asString(source.outletName),
		selective: asBoolean(source.selective, true),
		selectiveLogic: asNumber(source.selectiveLogic, 0) as EntryDraft['selectiveLogic'],
		scanDepth: asNullableNumber(source.scanDepth),
		caseSensitive: typeof source.caseSensitive === 'boolean' ? source.caseSensitive : null,
		matchWholeWords: typeof source.matchWholeWords === 'boolean' ? source.matchWholeWords : null,
		useGroupScoring: typeof source.useGroupScoring === 'boolean' ? source.useGroupScoring : null,
		matchPersonaDescription: asBoolean(source.matchPersonaDescription, false),
		matchCharacterDescription: asBoolean(source.matchCharacterDescription, false),
		matchCharacterPersonality: asBoolean(source.matchCharacterPersonality, false),
		matchCharacterDepthPrompt: asBoolean(source.matchCharacterDepthPrompt, false),
		matchScenario: asBoolean(source.matchScenario, false),
		matchCreatorNotes: asBoolean(source.matchCreatorNotes, false),
		constant: asBoolean(source.constant, false),
		disable: asBoolean(source.disable, false),
		useProbability: asBoolean(source.useProbability, true),
		probability: Math.max(0, Math.min(100, asNumber(source.probability, 100))),
		ignoreBudget: asBoolean(source.ignoreBudget, false),
		excludeRecursion: asBoolean(source.excludeRecursion, false),
		preventRecursion: asBoolean(source.preventRecursion, false),
		delayUntilRecursion: Math.max(0, asNumber(source.delayUntilRecursion, 0)),
		group: asString(source.group),
		groupOverride: asBoolean(source.groupOverride, false),
		groupWeight: Math.max(0, asNumber(source.groupWeight, 100)),
		sticky: asNullableNumber(source.sticky),
		cooldown: asNullableNumber(source.cooldown),
		delay: asNullableNumber(source.delay),
		triggers: asStringArray(source.triggers),
		role: asNumber(source.role, 0) as EntryDraft['role'],
		automationId: asString(source.automationId),
		characterFilter: {
			isExclude: asBoolean(filter.isExclude, false),
			names: asStringArray(filter.names),
			tags: asStringArray(filter.tags),
		},
		extensionsJson,
	};
}

function buildDraft(book: WorldInfoBookDto): BookDraft {
	const data: Record<string, unknown> = isRecord(book.data) ? book.data : {};
	const entriesRecord = isRecord(data.entries) ? data.entries : {};
	const entries = Object.keys(entriesRecord).map((id, index) => {
		const source = entriesRecord[id];
		return {
			id,
			original: isRecord(source) ? source : {},
			draft: normalizeEntry(source, index),
		};
	});
	return {
		id: book.id,
		name: book.name,
		slug: book.slug,
		description: book.description ?? '',
		version: book.version,
		entries,
	};
}

function toSnapshot(draft: BookDraft | null): string {
	return JSON.stringify(draft);
}

function nextEntryId(entries: EntryState[]): string {
	const numeric = entries.map((entry) => Number(entry.id)).filter((value) => Number.isFinite(value) && value >= 0);
	if (numeric.length === 0) return String(entries.length);
	return String(Math.max(...numeric) + 1);
}

function toEntryPayload(entry: EntryState): Record<string, unknown> {
	const extensionsRaw = JSON.parse(entry.draft.extensionsJson || '{}') as unknown;
	return {
		...entry.original,
		uid: entry.draft.uid,
		comment: entry.draft.comment,
		content: entry.draft.content,
		key: entry.draft.key,
		keysecondary: entry.draft.keysecondary,
		position: entry.draft.position,
		order: entry.draft.order,
		depth: entry.draft.depth,
		outletName: entry.draft.outletName,
		selective: entry.draft.selective,
		selectiveLogic: entry.draft.selectiveLogic,
		scanDepth: entry.draft.scanDepth,
		caseSensitive: entry.draft.caseSensitive,
		matchWholeWords: entry.draft.matchWholeWords,
		useGroupScoring: entry.draft.useGroupScoring,
		matchPersonaDescription: entry.draft.matchPersonaDescription,
		matchCharacterDescription: entry.draft.matchCharacterDescription,
		matchCharacterPersonality: entry.draft.matchCharacterPersonality,
		matchCharacterDepthPrompt: entry.draft.matchCharacterDepthPrompt,
		matchScenario: entry.draft.matchScenario,
		matchCreatorNotes: entry.draft.matchCreatorNotes,
		constant: entry.draft.constant,
		disable: entry.draft.disable,
		useProbability: entry.draft.useProbability,
		probability: entry.draft.probability,
		ignoreBudget: entry.draft.ignoreBudget,
		excludeRecursion: entry.draft.excludeRecursion,
		preventRecursion: entry.draft.preventRecursion,
		delayUntilRecursion: entry.draft.delayUntilRecursion,
		group: entry.draft.group,
		groupOverride: entry.draft.groupOverride,
		groupWeight: entry.draft.groupWeight,
		sticky: entry.draft.sticky,
		cooldown: entry.draft.cooldown,
		delay: entry.draft.delay,
		triggers: entry.draft.triggers,
		role: entry.draft.role,
		automationId: entry.draft.automationId,
		characterFilter: entry.draft.characterFilter,
		extensions: isRecord(extensionsRaw) ? extensionsRaw : {},
	};
}

export const WorldInfoEditorModal = ({ opened, book, saving, onClose, onSave }: Props) => {
	const { t } = useTranslation();
	const isMobile = useMediaQuery('(max-width: 48em)');
	const [draft, setDraft] = useState<BookDraft | null>(null);
	const [snapshot, setSnapshot] = useState('');
	const [entryId, setEntryId] = useState<string | null>(null);
	const [search, setSearch] = useState('');
	const [tab, setTab] = useState<EditorTab>('content');

	useEffect(() => {
		if (!opened || !book) return;
		const next = buildDraft(book);
		setDraft(next);
		setSnapshot(toSnapshot(next));
		setEntryId(next.entries[0]?.id ?? null);
		setSearch('');
		setTab('content');
	}, [book, opened]);

	const visibleEntries = useMemo(() => {
		if (!draft) return [];
		const query = search.trim().toLowerCase();
		if (!query) return draft.entries;
		return draft.entries.filter((entry) => {
			const text = [entry.id, entry.draft.comment, entry.draft.content, ...entry.draft.key, ...entry.draft.keysecondary]
				.join(' ')
				.toLowerCase();
			return text.includes(query);
		});
	}, [draft, search]);

	const activeEntry = useMemo(() => {
		if (!draft || !entryId) return null;
		return draft.entries.find((entry) => entry.id === entryId) ?? null;
	}, [draft, entryId]);

	const isDirty = toSnapshot(draft) !== snapshot;

	const requestClose = () => {
		if (saving) return;
		if (isDirty && !window.confirm(t('worldInfo.confirm.discardChanges'))) return;
		onClose();
	};

	const mutateDraft = (updater: (current: BookDraft) => BookDraft) => {
		setDraft((current) => (current ? updater(current) : current));
	};

	const mutateActiveEntry = (updater: (entry: EntryState) => EntryState) => {
		if (!entryId) return;
		mutateDraft((current) => ({
			...current,
			entries: current.entries.map((entry) => (entry.id === entryId ? updater(entry) : entry)),
		}));
	};

	const save = () => {
		if (!draft) return;
		if (!draft.name.trim()) {
			toaster.error({ title: t('worldInfo.toasts.bookNameRequired') });
			return;
		}

		try {
			const entries = Object.fromEntries(draft.entries.map((entry) => [entry.id, toEntryPayload(entry)]));
			onSave({
				id: draft.id,
				name: draft.name.trim(),
				slug: draft.slug.trim(),
				description: draft.description.trim() || null,
				data: { entries },
				version: draft.version,
			});
			setSnapshot(toSnapshot(draft));
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
			{!draft ? (
				<Text c="dimmed">{t('sidebars.selectBookToEdit')}</Text>
			) : (
				<Group align="stretch" wrap={isMobile ? 'wrap' : 'nowrap'} style={{ flex: 1, minHeight: 0 }}>
					<Stack
						gap="sm"
						style={{
							width: isMobile ? '100%' : 360,
							minWidth: isMobile ? 0 : 320,
							maxHeight: isMobile ? 320 : undefined,
						}}
					>
						<TextInput label={t('worldInfo.fields.name')} value={draft.name} onChange={(event) => mutateDraft((current) => ({ ...current, name: event.currentTarget.value }))} />
						<TextInput label={t('worldInfo.fields.slug')} value={draft.slug} onChange={(event) => mutateDraft((current) => ({ ...current, slug: event.currentTarget.value }))} />
						<TextInput label={t('worldInfo.fields.description')} value={draft.description} onChange={(event) => mutateDraft((current) => ({ ...current, description: event.currentTarget.value }))} />
						<Divider />
						<Group justify="space-between" align="center">
							<Text fw={600}>{t('worldInfo.editor.entriesTitle')}</Text>
							<Group gap={4}>
								<IconButtonWithTooltip
									icon={<LuPlus />}
									tooltip={t('worldInfo.editor.addEntry')}
									aria-label={t('worldInfo.editor.addEntry')}
									onClick={() => {
										const id = nextEntryId(draft.entries);
										mutateDraft((current) => ({ ...current, entries: [...current.entries, { id, original: {}, draft: normalizeEntry({ uid: current.entries.length }, current.entries.length) }] }));
										setEntryId(id);
									}}
								/>
								<IconButtonWithTooltip
									icon={<LuCopy />}
									tooltip={t('worldInfo.editor.duplicateEntry')}
									aria-label={t('worldInfo.editor.duplicateEntry')}
									disabled={!activeEntry}
									onClick={() => {
										if (!activeEntry) return;
										const id = nextEntryId(draft.entries);
										mutateDraft((current) => ({ ...current, entries: [...current.entries, { ...activeEntry, id }] }));
										setEntryId(id);
									}}
								/>
								<IconButtonWithTooltip
									icon={<LuTrash2 />}
									tooltip={t('worldInfo.editor.deleteEntry')}
									aria-label={t('worldInfo.editor.deleteEntry')}
									colorPalette="red"
									disabled={!activeEntry}
									onClick={() => {
										if (!activeEntry) return;
										mutateDraft((current) => {
											const nextEntries = current.entries.filter((entry) => entry.id !== activeEntry.id);
											setEntryId(nextEntries[0]?.id ?? null);
											return { ...current, entries: nextEntries };
										});
									}}
								/>
							</Group>
						</Group>
						<TextInput placeholder={t('worldInfo.editor.searchEntries')} value={search} onChange={(event) => setSearch(event.currentTarget.value)} />
						<ScrollArea style={{ flex: 1 }}>
							<Stack gap="xs">
								{visibleEntries.map((entry) => (
									<Button key={entry.id} variant={entry.id === entryId ? 'light' : 'subtle'} justify="flex-start" onClick={() => setEntryId(entry.id)}>
										{entry.draft.comment || entry.draft.key[0] || `entry #${entry.id}`}
									</Button>
								))}
							</Stack>
						</ScrollArea>
					</Stack>

					{!isMobile && <Divider orientation="vertical" />}

					<Stack gap="sm" style={{ flex: 1, minWidth: 0, width: isMobile ? '100%' : undefined }}>
						{!activeEntry ? (
							<Text c="dimmed" size="sm">{t('worldInfo.editor.selectEntry')}</Text>
						) : (
							<>
								<Group justify="space-between" align="center">
									<Text fw={600}>{t('worldInfo.editor.entryTitle', { id: activeEntry.id })}</Text>
									<Group gap={4}>
										<IconButtonWithTooltip icon={<LuArrowUp />} tooltip={t('agentCards.editor.actions.moveUp')} aria-label={t('agentCards.editor.actions.moveUp')} onClick={() => mutateDraft((current) => {
											const index = current.entries.findIndex((entry) => entry.id === activeEntry.id);
											if (index <= 0) return current;
											const next = current.entries.slice();
											const temp = next[index - 1];
											next[index - 1] = next[index];
											next[index] = temp;
											return { ...current, entries: next };
										})} />
										<IconButtonWithTooltip icon={<LuArrowDown />} tooltip={t('agentCards.editor.actions.moveDown')} aria-label={t('agentCards.editor.actions.moveDown')} onClick={() => mutateDraft((current) => {
											const index = current.entries.findIndex((entry) => entry.id === activeEntry.id);
											if (index < 0 || index >= current.entries.length - 1) return current;
											const next = current.entries.slice();
											const temp = next[index + 1];
											next[index + 1] = next[index];
											next[index] = temp;
											return { ...current, entries: next };
										})} />
									</Group>
								</Group>

								<Tabs value={tab} onChange={(value) => setTab((value as EditorTab) ?? 'content')}>
									<Tabs.List style={isMobile ? { overflowX: 'auto', flexWrap: 'nowrap' } : undefined}>
										<Tabs.Tab value="content">{t('worldInfo.editor.tabs.content')}</Tabs.Tab>
										<Tabs.Tab value="matching">{t('worldInfo.editor.tabs.matching')}</Tabs.Tab>
										<Tabs.Tab value="activation">{t('worldInfo.editor.tabs.activation')}</Tabs.Tab>
										<Tabs.Tab value="timing">{t('worldInfo.editor.tabs.timing')}</Tabs.Tab>
										<Tabs.Tab value="advanced">{t('worldInfo.editor.tabs.advanced')}</Tabs.Tab>
									</Tabs.List>

									<Tabs.Panel value="content" pt="md">
										<Stack gap="sm">
											<TextInput label={t('worldInfo.editor.fields.comment')} value={activeEntry.draft.comment} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, comment: event.currentTarget.value } }))} />
											<Textarea label={t('worldInfo.editor.fields.content')} minRows={8} autosize value={activeEntry.draft.content} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, content: event.currentTarget.value } }))} />
											<Group grow><Select label={t('worldInfo.editor.fields.position')} data={[{ value: '0', label: 'before' }, { value: '1', label: 'after' }, { value: '2', label: 'ANTop' }, { value: '3', label: 'ANBottom' }, { value: '4', label: 'atDepth' }, { value: '5', label: 'EMTop' }, { value: '6', label: 'EMBottom' }, { value: '7', label: 'outlet' }]} value={String(activeEntry.draft.position)} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, position: (Number(value) || 0) as EntryDraft['position'] } }))} comboboxProps={{ withinPortal: false }} /><NumberInput label={t('worldInfo.editor.fields.order')} value={activeEntry.draft.order} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, order: Number(value) || 0 } }))} /><NumberInput label={t('worldInfo.editor.fields.depth')} min={0} value={activeEntry.draft.depth} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, depth: Math.max(0, Number(value) || 0) } }))} /></Group>
											<TextInput label={t('worldInfo.editor.fields.outletName')} value={activeEntry.draft.outletName} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, outletName: event.currentTarget.value } }))} />
										</Stack>
									</Tabs.Panel>

									<Tabs.Panel value="matching" pt="md">
										<Stack gap="sm">
											<TagsInput label={t('worldInfo.editor.fields.key')} value={activeEntry.draft.key} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, key: value } }))} />
											<TagsInput label={t('worldInfo.editor.fields.keysecondary')} value={activeEntry.draft.keysecondary} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, keysecondary: value } }))} />
											<Group grow><Switch label={t('worldInfo.editor.fields.selective')} checked={activeEntry.draft.selective} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, selective: event.currentTarget.checked } }))} /><Select label={t('worldInfo.editor.fields.selectiveLogic')} data={[{ value: '0', label: 'AND_ANY' }, { value: '1', label: 'NOT_ALL' }, { value: '2', label: 'NOT_ANY' }, { value: '3', label: 'AND_ALL' }]} value={String(activeEntry.draft.selectiveLogic)} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, selectiveLogic: (Number(value) || 0) as EntryDraft['selectiveLogic'] } }))} comboboxProps={{ withinPortal: false }} /><NumberInput label={t('worldInfo.editor.fields.scanDepth')} min={0} value={activeEntry.draft.scanDepth ?? ''} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, scanDepth: value === '' ? null : Number(value) || 0 } }))} /></Group>
											<Group grow><Select label={t('worldInfo.editor.fields.caseSensitive')} data={[{ value: 'inherit', label: t('worldInfo.editor.inherit') }, { value: 'true', label: t('worldInfo.editor.true') }, { value: 'false', label: t('worldInfo.editor.false') }]} value={toNullableBool(activeEntry.draft.caseSensitive)} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, caseSensitive: parseNullableBool((value as NullableBoolSelect) ?? 'inherit') } }))} comboboxProps={{ withinPortal: false }} /><Select label={t('worldInfo.editor.fields.matchWholeWords')} data={[{ value: 'inherit', label: t('worldInfo.editor.inherit') }, { value: 'true', label: t('worldInfo.editor.true') }, { value: 'false', label: t('worldInfo.editor.false') }]} value={toNullableBool(activeEntry.draft.matchWholeWords)} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, matchWholeWords: parseNullableBool((value as NullableBoolSelect) ?? 'inherit') } }))} comboboxProps={{ withinPortal: false }} /><Select label={t('worldInfo.editor.fields.useGroupScoring')} data={[{ value: 'inherit', label: t('worldInfo.editor.inherit') }, { value: 'true', label: t('worldInfo.editor.true') }, { value: 'false', label: t('worldInfo.editor.false') }]} value={toNullableBool(activeEntry.draft.useGroupScoring)} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, useGroupScoring: parseNullableBool((value as NullableBoolSelect) ?? 'inherit') } }))} comboboxProps={{ withinPortal: false }} /></Group>
											<Group grow>
												<Switch label={t('worldInfo.editor.fields.matchPersonaDescription')} checked={activeEntry.draft.matchPersonaDescription} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, matchPersonaDescription: event.currentTarget.checked } }))} />
												<Switch label={t('worldInfo.editor.fields.matchCharacterDescription')} checked={activeEntry.draft.matchCharacterDescription} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, matchCharacterDescription: event.currentTarget.checked } }))} />
												<Switch label={t('worldInfo.editor.fields.matchCharacterPersonality')} checked={activeEntry.draft.matchCharacterPersonality} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, matchCharacterPersonality: event.currentTarget.checked } }))} />
											</Group>
											<Group grow>
												<Switch label={t('worldInfo.editor.fields.matchCharacterDepthPrompt')} checked={activeEntry.draft.matchCharacterDepthPrompt} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, matchCharacterDepthPrompt: event.currentTarget.checked } }))} />
												<Switch label={t('worldInfo.editor.fields.matchScenario')} checked={activeEntry.draft.matchScenario} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, matchScenario: event.currentTarget.checked } }))} />
												<Switch label={t('worldInfo.editor.fields.matchCreatorNotes')} checked={activeEntry.draft.matchCreatorNotes} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, matchCreatorNotes: event.currentTarget.checked } }))} />
											</Group>
										</Stack>
									</Tabs.Panel>

									<Tabs.Panel value="activation" pt="md">
										<Stack gap="sm"><Group grow><Switch label={t('worldInfo.editor.fields.constant')} checked={activeEntry.draft.constant} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, constant: event.currentTarget.checked } }))} /><Switch label={t('worldInfo.editor.fields.disable')} checked={activeEntry.draft.disable} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, disable: event.currentTarget.checked } }))} /><Switch label={t('worldInfo.editor.fields.ignoreBudget')} checked={activeEntry.draft.ignoreBudget} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, ignoreBudget: event.currentTarget.checked } }))} /></Group><Group grow><Switch label={t('worldInfo.editor.fields.useProbability')} checked={activeEntry.draft.useProbability} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, useProbability: event.currentTarget.checked } }))} /><NumberInput label={t('worldInfo.editor.fields.probability')} min={0} max={100} value={activeEntry.draft.probability} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, probability: Math.max(0, Math.min(100, Number(value) || 0)) } }))} /><NumberInput label={t('worldInfo.editor.fields.delayUntilRecursion')} min={0} value={activeEntry.draft.delayUntilRecursion} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, delayUntilRecursion: Math.max(0, Number(value) || 0) } }))} /></Group><Group grow><Switch label={t('worldInfo.editor.fields.excludeRecursion')} checked={activeEntry.draft.excludeRecursion} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, excludeRecursion: event.currentTarget.checked } }))} /><Switch label={t('worldInfo.editor.fields.preventRecursion')} checked={activeEntry.draft.preventRecursion} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, preventRecursion: event.currentTarget.checked } }))} /><TextInput label={t('worldInfo.editor.fields.group')} value={activeEntry.draft.group} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, group: event.currentTarget.value } }))} /></Group><Group grow><Switch label={t('worldInfo.editor.fields.groupOverride')} checked={activeEntry.draft.groupOverride} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, groupOverride: event.currentTarget.checked } }))} /><NumberInput label={t('worldInfo.editor.fields.groupWeight')} min={0} value={activeEntry.draft.groupWeight} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, groupWeight: Math.max(0, Number(value) || 0) } }))} /></Group></Stack>
									</Tabs.Panel>

									<Tabs.Panel value="timing" pt="md">
										<Stack gap="sm"><Group grow><NumberInput label={t('worldInfo.editor.fields.sticky')} min={0} value={activeEntry.draft.sticky ?? ''} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, sticky: value === '' ? null : Number(value) || 0 } }))} /><NumberInput label={t('worldInfo.editor.fields.cooldown')} min={0} value={activeEntry.draft.cooldown ?? ''} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, cooldown: value === '' ? null : Number(value) || 0 } }))} /><NumberInput label={t('worldInfo.editor.fields.delay')} min={0} value={activeEntry.draft.delay ?? ''} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, delay: value === '' ? null : Number(value) || 0 } }))} /></Group><TagsInput label={t('worldInfo.editor.fields.triggers')} value={activeEntry.draft.triggers} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, triggers: value } }))} /></Stack>
									</Tabs.Panel>

									<Tabs.Panel value="advanced" pt="md">
										<Stack gap="sm"><Group grow><Select label={t('worldInfo.editor.fields.role')} data={[{ value: '0', label: 'system' }, { value: '1', label: 'user' }, { value: '2', label: 'assistant' }]} value={String(activeEntry.draft.role)} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, role: (Number(value) || 0) as EntryDraft['role'] } }))} comboboxProps={{ withinPortal: false }} /><NumberInput label={t('worldInfo.editor.fields.uid')} min={0} value={activeEntry.draft.uid} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, uid: Math.max(0, Number(value) || 0) } }))} /><TextInput label={t('worldInfo.editor.fields.automationId')} value={activeEntry.draft.automationId} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, automationId: event.currentTarget.value } }))} /></Group><Switch label={t('worldInfo.editor.fields.characterFilterExclude')} checked={activeEntry.draft.characterFilter.isExclude} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, characterFilter: { ...entry.draft.characterFilter, isExclude: event.currentTarget.checked } } }))} /><TagsInput label={t('worldInfo.editor.fields.characterFilterNames')} value={activeEntry.draft.characterFilter.names} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, characterFilter: { ...entry.draft.characterFilter, names: value } } }))} /><TagsInput label={t('worldInfo.editor.fields.characterFilterTags')} value={activeEntry.draft.characterFilter.tags} onChange={(value) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, characterFilter: { ...entry.draft.characterFilter, tags: value } } }))} /><Textarea label={t('worldInfo.editor.fields.extensionsJson')} minRows={6} autosize value={activeEntry.draft.extensionsJson} onChange={(event) => mutateActiveEntry((entry) => ({ ...entry, draft: { ...entry.draft, extensionsJson: event.currentTarget.value } }))} /></Stack>
									</Tabs.Panel>
								</Tabs>
							</>
						)}
					</Stack>
				</Group>
			)}
		</Dialog>
	);
};
