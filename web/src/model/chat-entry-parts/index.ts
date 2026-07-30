import { createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';

import { abortGeneration } from '../../api/chat-core';
import {
	batchUpdateEntryParts,
	deleteEntryVariant,
	getEntryPromptDiagnostics,
	listChatEntries,
	listEntryVariants,
	manualEditEntry,
	selectEntryVariant,
	softDeleteEntry,
	softDeleteEntriesBulk,
	softDeletePart,
	undoCanonicalization,
	setEntryPromptVisibility,
	streamChatEntry,
	streamContinueEntry,
	streamRegenerateEntry,
} from '../../api/chat-entry-parts';
import i18n from '../../i18n';
import { $currentBranchId, $currentChat, setOpenedChat } from '../chat-core';
import { logChatGenerationSseEvent } from '../chat-generation-debug';
import { userPersonsModel } from '../user-persons';

import { applyAssistantCanonicalizationPatch } from './assistant-canonicalization';
import { readOperationFinishedFailure } from './operation-finished-failure';

import type { SseEnvelope } from '../../api/chat-core';
import type {
	BatchUpdateEntryPartsRequest,
	ChatEntryWithVariantDto,
	EntriesCursor,
	ListChatEntriesResponse,
	PromptDiagnosticsResponse,
} from '../../api/chat-entry-parts';
import type { Entry, Part, Variant } from '@shared/types/chat-entry-parts';

function nowIso(): string {
	return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readHttpStatus(error: unknown): number | null {
	if (!isRecord(error)) return null;
	const status = error.status;
	return typeof status === 'number' && Number.isFinite(status) ? status : null;
}

const ENTRIES_PAGE_SIZE = 50;
const ENTRIES_SYNC_MAX = 200;
const BOTTOM_DISTANCE_PX = 120;

export type EntriesPageInfoState = {
	hasMoreOlder: boolean;
	nextCursor: EntriesCursor | null;
	isLoadingInitial: boolean;
	isLoadingOlder: boolean;
	isSyncingLatest: boolean;
};

export type ChatViewportState = {
	isAtBottom: boolean;
	unseenCount: number;
	bottomDistancePx: number;
};

function compareEntriesAsc(
	left: ChatEntryWithVariantDto,
	right: ChatEntryWithVariantDto,
): number {
	if (left.entry.createdAt !== right.entry.createdAt) {
		return left.entry.createdAt - right.entry.createdAt;
	}
	return left.entry.entryId.localeCompare(right.entry.entryId);
}

function isEntryOlderThan(
	entry: ChatEntryWithVariantDto,
	anchor: ChatEntryWithVariantDto,
): boolean {
	if (entry.entry.createdAt !== anchor.entry.createdAt) {
		return entry.entry.createdAt < anchor.entry.createdAt;
	}
	return entry.entry.entryId.localeCompare(anchor.entry.entryId) < 0;
}

function mergeEntriesStable(
	existing: ChatEntryWithVariantDto[],
	incoming: ChatEntryWithVariantDto[],
): ChatEntryWithVariantDto[] {
	const byId = new Map<string, ChatEntryWithVariantDto>();
	for (const item of existing) byId.set(item.entry.entryId, item);
	for (const item of incoming) byId.set(item.entry.entryId, item);
	return Array.from(byId.values()).sort(compareEntriesAsc);
}

function mergeLatestWindow(
	existing: ChatEntryWithVariantDto[],
	incoming: ChatEntryWithVariantDto[],
): ChatEntryWithVariantDto[] {
	if (incoming.length === 0) return existing;
	const oldestIncoming = incoming[0];
	const preservedOlder = existing.filter((item) => isEntryOlderThan(item, oldestIncoming));
	return mergeEntriesStable(preservedOlder, incoming);
}

const EMPTY_PAGE_INFO: EntriesPageInfoState = {
	hasMoreOlder: false,
	nextCursor: null,
	isLoadingInitial: false,
	isLoadingOlder: false,
	isSyncingLatest: false,
};

export const loadInitialPageFx = createEffect(async (params: { chatId: string; branchId: string }) => {
	return listChatEntries({ chatId: params.chatId, branchId: params.branchId, limit: ENTRIES_PAGE_SIZE });
});

export const loadEntriesFx = createEffect(
	async (params: { chatId: string; branchId: string; limit?: number }) => {
		return listChatEntries({
			chatId: params.chatId,
			branchId: params.branchId,
			limit: Math.min(Math.max(params.limit ?? ENTRIES_SYNC_MAX, ENTRIES_PAGE_SIZE), ENTRIES_SYNC_MAX),
		});
	},
);

export const loadOlderPageFx = createEffect(
	async (params: { chatId: string; branchId: string; cursor: EntriesCursor; limit?: number }) => {
		return listChatEntries({
			chatId: params.chatId,
			branchId: params.branchId,
			limit: Math.min(Math.max(params.limit ?? ENTRIES_PAGE_SIZE, 1), ENTRIES_SYNC_MAX),
			cursorCreatedAt: params.cursor.createdAt,
			cursorEntryId: params.cursor.entryId,
		});
	},
);

export const loadOlderPageRequested = createEvent();

export const $entries = createStore<ChatEntryWithVariantDto[]>([])
	.on(loadInitialPageFx.doneData, (_prev, res) => mergeEntriesStable([], res.entries))
	.on(loadEntriesFx.doneData, (prev, res) => mergeLatestWindow(prev, res.entries))
	.on(loadOlderPageFx.doneData, (prev, res) => mergeEntriesStable(res.entries, prev))
	.on(setOpenedChat, () => []);

export const $currentTurn = createStore<number>(0)
	.on(loadInitialPageFx.doneData, (_prev, res) => res.currentTurn)
	.on(loadEntriesFx.doneData, (_prev, res) => res.currentTurn)
	.on(loadOlderPageFx.doneData, (_prev, res) => res.currentTurn)
	.on(setOpenedChat, () => 0);

export const $entriesPageInfo = createStore<EntriesPageInfoState>(EMPTY_PAGE_INFO)
	.on(loadInitialPageFx, (state) => ({ ...state, isLoadingInitial: true, isSyncingLatest: false }))
	.on(loadInitialPageFx.doneData, (_state, res) => ({
		hasMoreOlder: res.pageInfo.hasMoreOlder,
		nextCursor: res.pageInfo.nextCursor,
		isLoadingInitial: false,
		isLoadingOlder: false,
		isSyncingLatest: false,
	}))
	.on(loadInitialPageFx.fail, (state) => ({ ...state, isLoadingInitial: false }))
	.on(loadEntriesFx, (state) => ({ ...state, isSyncingLatest: true }))
	.on(loadEntriesFx.doneData, (state, res) => ({
		hasMoreOlder: state.hasMoreOlder || res.pageInfo.hasMoreOlder,
		nextCursor: state.nextCursor ?? res.pageInfo.nextCursor,
		isLoadingInitial: false,
		isLoadingOlder: false,
		isSyncingLatest: false,
	}))
	.on(loadEntriesFx.fail, (state) => ({ ...state, isSyncingLatest: false }))
	.on(loadOlderPageFx, (state) => ({ ...state, isLoadingOlder: true }))
	.on(loadOlderPageFx.doneData, (_state, res) => ({
		hasMoreOlder: res.pageInfo.hasMoreOlder,
		nextCursor: res.pageInfo.nextCursor,
		isLoadingInitial: false,
		isLoadingOlder: false,
		isSyncingLatest: false,
	}))
	.on(loadOlderPageFx.fail, (state) => ({ ...state, isLoadingOlder: false }))
	.on(setOpenedChat, () => EMPTY_PAGE_INFO);

export const chatViewportChanged = createEvent<{ distanceToBottom: number }>();
export const resetUnseenMessages = createEvent();
export const incrementUnseenMessages = createEvent<{ count?: number }>();

export const $chatViewportState = createStore<ChatViewportState>({
	isAtBottom: true,
	unseenCount: 0,
	bottomDistancePx: 0,
})
	.on(chatViewportChanged, (state, payload) => {
		const distance = Math.max(0, payload.distanceToBottom);
		const isAtBottom = distance <= BOTTOM_DISTANCE_PX;
		return {
			isAtBottom,
			unseenCount: isAtBottom ? 0 : state.unseenCount,
			bottomDistancePx: distance,
		};
	})
	.on(resetUnseenMessages, (state) => ({ ...state, unseenCount: 0 }))
	.on(incrementUnseenMessages, (state, payload) =>
		state.isAtBottom
			? { ...state, unseenCount: 0 }
			: { ...state, unseenCount: state.unseenCount + Math.max(1, payload.count ?? 1) },
	)
	.on(setOpenedChat, () => ({
		isAtBottom: true,
		unseenCount: 0,
		bottomDistancePx: 0,
	}));

export const $isBulkDeleteMode = createStore(false);
export const $bulkDeleteSelectedEntryIds = createStore<string[]>([]);
export const enterBulkDeleteMode = createEvent();
export const exitBulkDeleteMode = createEvent();
export const toggleBulkDeleteEntrySelection = createEvent<{ entryId: string }>();
export const clearBulkDeleteSelection = createEvent();

const reportLoadEntriesError = (error: unknown) => {
	toaster.error({ title: i18n.t('chat.toasts.loadChatError'), description: error instanceof Error ? error.message : String(error) });
};
loadInitialPageFx.failData.watch(reportLoadEntriesError);
loadEntriesFx.failData.watch(reportLoadEntriesError);
loadOlderPageFx.failData.watch(reportLoadEntriesError);

// Reload entries when we open a chat (chat-core still owns chat/branch selection).
sample({
	clock: setOpenedChat,
	fn: ({ chat, branchId }) => ({ chatId: chat.id, branchId }),
	target: loadInitialPageFx,
});

sample({
	clock: loadOlderPageRequested,
	source: {
		chat: $currentChat,
		branchId: $currentBranchId,
		pageInfo: $entriesPageInfo,
	},
	filter: ({ chat, branchId, pageInfo }) =>
		Boolean(chat?.id && branchId && pageInfo.hasMoreOlder && pageInfo.nextCursor && !pageInfo.isLoadingOlder),
	fn: ({ chat, branchId, pageInfo }) => ({
		chatId: chat!.id,
		branchId: branchId!,
		cursor: pageInfo.nextCursor!,
	}),
	target: loadOlderPageFx,
});

const reconcileBulkSelection = createEvent<ListChatEntriesResponse>();

$isBulkDeleteMode
	.on(enterBulkDeleteMode, () => true)
	.on(exitBulkDeleteMode, () => false)
	.on(setOpenedChat, () => false);

$bulkDeleteSelectedEntryIds
	.on(toggleBulkDeleteEntrySelection, (selected, { entryId }) =>
		selected.includes(entryId) ? selected.filter((id) => id !== entryId) : [...selected, entryId],
	)
	.on(enterBulkDeleteMode, () => [])
	.on(exitBulkDeleteMode, () => [])
	.on(clearBulkDeleteSelection, () => [])
	.on(setOpenedChat, () => []);

sample({ clock: loadInitialPageFx.doneData, target: reconcileBulkSelection });
sample({ clock: loadEntriesFx.doneData, target: reconcileBulkSelection });
sample({ clock: loadOlderPageFx.doneData, target: reconcileBulkSelection });
sample({
	clock: reconcileBulkSelection,
	source: $bulkDeleteSelectedEntryIds,
	fn: (selected, res) => {
		const available = new Set(res.entries.map((item) => item.entry.entryId));
		return selected.filter((id) => available.has(id));
	},
	target: $bulkDeleteSelectedEntryIds,
});

export type PromptInspectorState = {
	open: boolean;
	entryId: string | null;
	variantId: string | null;
	loading: boolean;
	error: string | null;
	data: PromptDiagnosticsResponse | null;
};

export type UndoCanonicalizationStep = {
	partId: string;
	replacesPartId: string;
	beforeText: string;
	afterText: string;
	createdTurn: number;
};

export type UndoCanonicalizationPickerState = {
	open: boolean;
	entryId: string | null;
	steps: UndoCanonicalizationStep[];
	selectedPartId: string | null;
};

export type EntryPartsEditorState = {
	open: boolean;
	entryId: string | null;
};

export const openPromptInspectorRequested = createEvent<{ entryId: string; variantId?: string | null }>();
export const closePromptInspectorRequested = createEvent();
export const openEntryPartsEditorRequested = createEvent<{ entryId: string }>();
export const closeEntryPartsEditorRequested = createEvent();
export const saveEntryPartsEditorRequested = createEvent<BatchUpdateEntryPartsRequest>();
const setPromptInspectorRequest = createEvent<{ entryId: string; variantId: string | null }>();
const resetPromptInspectorData = createEvent();
const setUndoCanonicalizationPickerState = createEvent<UndoCanonicalizationPickerState>();
const setEntryPartsEditorState = createEvent<EntryPartsEditorState>();

export const loadPromptInspectorFx = createEffect(async (params: { entryId: string; variantId: string | null }) => {
	return getEntryPromptDiagnostics({
		entryId: params.entryId,
		variantId: params.variantId ?? undefined,
	});
});

export const undoCanonicalizationFx = createEffect(async (params: { partId: string }) => {
	return undoCanonicalization(params.partId);
});
export const batchUpdateEntryPartsFx = createEffect(async (params: BatchUpdateEntryPartsRequest) => {
	return batchUpdateEntryParts(params);
});

export const openUndoCanonicalizationPickerRequested = createEvent<{ entryId: string }>();
export const closeUndoCanonicalizationPickerRequested = createEvent();
export const selectUndoCanonicalizationStepRequested = createEvent<{ partId: string }>();
export const confirmUndoCanonicalizationRequested = createEvent();
export const undoCanonicalizationRequested = createEvent<{ partId: string }>();
const refreshVariantsAfterUndo = createEvent<{ entryId: string }>();
const refreshVariantsAfterPartBatchUpdate = createEvent<{ entryId: string }>();

export const $promptInspectorState = createStore<PromptInspectorState>({
	open: false,
	entryId: null,
	variantId: null,
	loading: false,
	error: null,
	data: null,
})
	.on(setPromptInspectorRequest, (_state, payload) => ({
		open: true,
		entryId: payload.entryId,
		variantId: payload.variantId,
		loading: true,
		error: null,
		data: null,
	}))
	.on(loadPromptInspectorFx.doneData, (state, data) => ({
		...state,
		loading: false,
		error: null,
		data,
	}))
	.on(loadPromptInspectorFx.failData, (state, error) => ({
		...state,
		loading: false,
		error: error instanceof Error ? error.message : String(error),
		data: null,
	}))
	.on(closePromptInspectorRequested, (state) => ({
		...state,
		open: false,
	}))
	.on(resetPromptInspectorData, () => ({
		open: false,
		entryId: null,
		variantId: null,
		loading: false,
		error: null,
		data: null,
	}))
	.on(setOpenedChat, () => ({
		open: false,
		entryId: null,
		variantId: null,
		loading: false,
		error: null,
		data: null,
	}));

sample({
	clock: openPromptInspectorRequested,
	fn: ({ entryId, variantId }) => ({ entryId, variantId: variantId ?? null }),
	target: setPromptInspectorRequest,
});

sample({
	clock: setPromptInspectorRequest,
	target: loadPromptInspectorFx,
});

sample({
	clock: closePromptInspectorRequested,
	target: resetPromptInspectorData,
});

const EMPTY_ENTRY_PARTS_EDITOR_STATE: EntryPartsEditorState = {
	open: false,
	entryId: null,
};

export const $entryPartsEditorState = createStore<EntryPartsEditorState>(EMPTY_ENTRY_PARTS_EDITOR_STATE)
	.on(setEntryPartsEditorState, (_state, payload) => payload)
	.on(closeEntryPartsEditorRequested, () => EMPTY_ENTRY_PARTS_EDITOR_STATE)
	.on(batchUpdateEntryPartsFx.done, () => EMPTY_ENTRY_PARTS_EDITOR_STATE)
	.on(setOpenedChat, () => EMPTY_ENTRY_PARTS_EDITOR_STATE);

sample({
	clock: openEntryPartsEditorRequested,
	fn: ({ entryId }) => ({ open: true, entryId }),
	target: setEntryPartsEditorState,
});

sample({
	clock: saveEntryPartsEditorRequested,
	target: batchUpdateEntryPartsFx,
});

sample({
	clock: batchUpdateEntryPartsFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

sample({
	clock: batchUpdateEntryPartsFx.doneData,
	fn: ({ entryId }) => ({ entryId }),
	target: refreshVariantsAfterPartBatchUpdate,
});

sample({
	clock: batchUpdateEntryPartsFx.failData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }, error) => Boolean(chat?.id && branchId) && readHttpStatus(error) === 409,
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

function readPartPayloadText(payload: Part['payload']): string {
	if (typeof payload === 'string') return payload;
	try {
		return JSON.stringify(payload);
	} catch {
		return String(payload);
	}
}

function isCanonicalizationReplacementPart(part: Part): boolean {
	if (part.softDeleted) return false;
	if (part.channel !== 'main') return false;
	if (part.source !== 'agent') return false;
	const replacesPartId = typeof part.replacesPartId === 'string' ? part.replacesPartId.trim() : '';
	if (!replacesPartId) return false;
	return Array.isArray(part.tags) && part.tags.includes('canonicalization');
}

function buildActiveReplacementMap(parts: Part[]): Map<string, string> {
	const byOriginal = new Map<string, Part[]>();
	for (const part of parts) {
		if (part.softDeleted) continue;
		const replacesPartId = typeof part.replacesPartId === 'string' ? part.replacesPartId.trim() : '';
		if (!replacesPartId) continue;
		const existing = byOriginal.get(replacesPartId);
		if (existing) existing.push(part);
		else byOriginal.set(replacesPartId, [part]);
	}

	const map = new Map<string, string>();
	for (const [originalId, candidates] of byOriginal.entries()) {
		candidates.sort((left, right) => {
			if (left.createdTurn !== right.createdTurn) return right.createdTurn - left.createdTurn;
			if (left.partId < right.partId) return -1;
			if (left.partId > right.partId) return 1;
			return 0;
		});
		const winner = candidates[0];
		if (winner) map.set(originalId, winner.partId);
	}
	return map;
}

function resolveUndoCanonicalizationStepsForEntry(
	entries: ChatEntryWithVariantDto[],
	entryId: string,
): UndoCanonicalizationStep[] {
	const entry = entries.find((item) => item.entry.entryId === entryId);
	const parts = entry?.variant?.parts ?? [];
	if (parts.length === 0) return [];

	const activeMainParts = parts.filter((part) => !part.softDeleted && part.channel === 'main');
	if (activeMainParts.length === 0) return [];

	const activeReplacementMap = buildActiveReplacementMap(parts);
	const terminalMainParts = activeMainParts.filter((part) => !activeReplacementMap.has(part.partId));
	const terminalMain =
		terminalMainParts
			.slice()
			.sort((left, right) => {
				if (left.order !== right.order) return left.order - right.order;
				if (left.createdTurn !== right.createdTurn) return left.createdTurn - right.createdTurn;
				return left.partId.localeCompare(right.partId);
			})
			.pop() ?? null;
	if (!terminalMain) return [];

	const byId = new Map(parts.map((part) => [part.partId, part] as const));
	const chain: UndoCanonicalizationStep[] = [];
	let cursor: Part | null = terminalMain;
	while (cursor) {
		if (isCanonicalizationReplacementPart(cursor)) {
			const replacesPartId = (cursor.replacesPartId as string).trim();
			const previousPart = byId.get(replacesPartId);
			chain.push({
				partId: cursor.partId,
				replacesPartId,
				beforeText: previousPart ? readPartPayloadText(previousPart.payload) : '',
				afterText: readPartPayloadText(cursor.payload),
				createdTurn: cursor.createdTurn,
			});
		}
		const parentId: string = typeof cursor.replacesPartId === 'string' ? cursor.replacesPartId.trim() : '';
		cursor = parentId ? byId.get(parentId) ?? null : null;
	}

	return chain.reverse();
}

const EMPTY_UNDO_CANONICALIZATION_PICKER_STATE: UndoCanonicalizationPickerState = {
	open: false,
	entryId: null,
	steps: [],
	selectedPartId: null,
};

export const $undoCanonicalizationPickerState = createStore<UndoCanonicalizationPickerState>(
	EMPTY_UNDO_CANONICALIZATION_PICKER_STATE,
)
	.on(setUndoCanonicalizationPickerState, (_state, payload) => payload)
	.on(selectUndoCanonicalizationStepRequested, (state, payload) => {
		if (!state.open) return state;
		if (!state.steps.some((step) => step.partId === payload.partId)) return state;
		return {
			...state,
			selectedPartId: payload.partId,
		};
	})
	.on(closeUndoCanonicalizationPickerRequested, () => EMPTY_UNDO_CANONICALIZATION_PICKER_STATE)
	.on(undoCanonicalizationFx.done, () => EMPTY_UNDO_CANONICALIZATION_PICKER_STATE)
	.on(setOpenedChat, () => EMPTY_UNDO_CANONICALIZATION_PICKER_STATE);

sample({
	clock: openUndoCanonicalizationPickerRequested,
	source: $entries,
	fn: (entries, { entryId }) => {
		const steps = resolveUndoCanonicalizationStepsForEntry(entries, entryId);
		return {
			open: true,
			entryId,
			steps,
			selectedPartId: steps.length > 0 ? steps[steps.length - 1].partId : null,
		} satisfies UndoCanonicalizationPickerState;
	},
	target: setUndoCanonicalizationPickerState,
});

sample({
	clock: confirmUndoCanonicalizationRequested,
	source: { state: $undoCanonicalizationPickerState, pending: undoCanonicalizationFx.pending },
	filter: ({ state, pending }) => state.open && !pending && typeof state.selectedPartId === 'string',
	fn: ({ state }) => ({ partId: state.selectedPartId as string }),
	target: undoCanonicalizationRequested,
});

sample({
	clock: undoCanonicalizationRequested,
	target: undoCanonicalizationFx,
});

sample({
	clock: undoCanonicalizationFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

sample({
	clock: undoCanonicalizationFx.doneData,
	fn: ({ entryId }) => ({ entryId }),
	target: refreshVariantsAfterUndo,
});

sample({
	clock: undoCanonicalizationFx.doneData,
	source: $promptInspectorState,
	filter: (state) => Boolean(state.open && state.entryId),
	fn: (state) => ({
		entryId: state.entryId as string,
		variantId: state.variantId ?? null,
	}),
	target: loadPromptInspectorFx,
});

export const $isChatStreaming = createStore(false);
export const $activeGenerationId = createStore<string | null>(null);

export const sendMessageRequested = createEvent<{ promptText: string; role?: 'user' | 'system' }>();
export const continueFromLastUserRequested = createEvent();
export const abortRequested = createEvent();

// Preplay greeting may be rerendered on backend when selected persona changes.
sample({
	clock: userPersonsModel.updateSettingsFx.done,
	source: { chat: $currentChat, branchId: $currentBranchId, isStreaming: $isChatStreaming },
	filter: ({ chat, branchId, isStreaming }, { params }) => {
		if (!chat?.id || !branchId || isStreaming) return false;
		return typeof params.selectedId !== 'undefined' || typeof params.enabled !== 'undefined';
	},
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

type ActiveStreamState = {
	controller: AbortController;
	chatId: string;
	branchId: string;
	mode: 'send' | 'regenerate' | 'continue';

	// Local optimistic ids
	pendingUserEntryId?: string;
	pendingUserMainPartId?: string;
	pendingAssistantEntryId?: string;
	pendingAssistantMainPartId?: string;
	pendingAssistantReasoningPartId?: string;

	// Server ids (learned from llm.stream.meta)
	userMainPartId?: string;
	assistantEntryId?: string;
	assistantMainPartId?: string;
	assistantReasoningPartId?: string;
	generationId?: string;
};

const $activeStream = createStore<ActiveStreamState | null>(null);

type LocalPrep = {
	controller: AbortController;
	chatId: string;
	branchId: string;
	role: 'user' | 'system';
	promptText: string;
	pendingUserEntryId: string;
	pendingUserMainPartId: string;
	pendingAssistantEntryId: string;
	pendingAssistantMainPartId: string;
	pendingAssistantReasoningPartId: string;
	mode: 'send';
};

type ContinuePrep = {
	controller: AbortController;
	chatId: string;
	branchId: string;
	pendingAssistantEntryId: string;
	pendingAssistantMainPartId: string;
	pendingAssistantReasoningPartId: string;
	mode: 'continue';
};

export const prepareSendFx = createEffect(async (params: { chatId: string; branchId: string; role: 'user' | 'system'; promptText: string }) => {
	const controller = new AbortController();
	const pendingUserEntryId = `local_user_${nowIso()}`;
	const pendingUserMainPartId = `local_part_${nowIso()}`;
	const pendingAssistantEntryId = `local_assistant_${nowIso()}`;
	const pendingAssistantMainPartId = `local_part_${nowIso()}`;
	const pendingAssistantReasoningPartId = `local_part_${nowIso()}`;
	return {
		controller,
		chatId: params.chatId,
		branchId: params.branchId,
		role: params.role,
		promptText: params.promptText,
		pendingUserEntryId,
		pendingUserMainPartId,
		pendingAssistantEntryId,
		pendingAssistantMainPartId,
		pendingAssistantReasoningPartId,
		mode: 'send' as const,
	} satisfies LocalPrep;
});

sample({
	clock: sendMessageRequested,
	source: { chat: $currentChat, branchId: $currentBranchId, isStreaming: $isChatStreaming },
	filter: ({ chat, branchId, isStreaming }, { promptText }) =>
		Boolean(chat?.id && branchId && !isStreaming && promptText.trim().length > 0),
	fn: ({ chat, branchId }, { promptText, role }) => ({
		chatId: chat!.id,
		branchId: branchId!,
		role: role ?? 'user',
		promptText,
	}),
	target: prepareSendFx,
});

export const prepareContinueFx = createEffect(async (params: { chatId: string; branchId: string }) => {
	const controller = new AbortController();
	const pendingAssistantEntryId = `local_assistant_${nowIso()}`;
	const pendingAssistantMainPartId = `local_part_${nowIso()}`;
	const pendingAssistantReasoningPartId = `local_part_${nowIso()}`;
	return {
		controller,
		chatId: params.chatId,
		branchId: params.branchId,
		pendingAssistantEntryId,
		pendingAssistantMainPartId,
		pendingAssistantReasoningPartId,
		mode: 'continue' as const,
	} satisfies ContinuePrep;
});

sample({
	clock: continueFromLastUserRequested,
	source: { chat: $currentChat, branchId: $currentBranchId, isStreaming: $isChatStreaming, entries: $entries },
	filter: ({ chat, branchId, isStreaming, entries }) => {
		if (!chat?.id || !branchId || isStreaming) return false;
		const last = entries[entries.length - 1];
		return Boolean(last && last.entry.role === 'user');
	},
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: prepareContinueFx,
});

function makeLocalVariant(params: {
	entryId: string;
	role: Entry['role'];
	createdAt: number;
	parts: Part[];
}): ChatEntryWithVariantDto {
	const variantId = `local_variant_${nowIso()}`;
	const entry: Entry = {
		entryId: params.entryId,
		chatId: 'local',
		branchId: 'local',
		role: params.role,
		createdAt: params.createdAt,
		activeVariantId: variantId,
		meta: { optimistic: true } as any,
	};
	const variant: Variant = {
		variantId,
		entryId: params.entryId,
		kind: 'manual_edit',
		createdAt: params.createdAt,
		parts: params.parts,
	};
	return { entry, variant };
}

// Optimistic insert: user entry + assistant placeholder
sample({
	clock: prepareSendFx.doneData,
	source: { entries: $entries, chat: $currentChat, branchId: $currentBranchId },
	fn: ({ entries, chat, branchId }, prep) => {
		const now = Date.now();
		const userPart: Part = {
			partId: prep.pendingUserMainPartId,
			channel: 'main',
			order: 0,
			payload: prep.promptText,
			payloadFormat: 'markdown',
			visibility: { ui: 'always', prompt: true },
			ui: { rendererId: 'markdown' },
			prompt: { serializerId: 'asText' },
			lifespan: 'infinite',
			createdTurn: 0,
			source: 'user',
		};

		const assistantPart: Part = {
			partId: prep.pendingAssistantMainPartId,
			channel: 'main',
			order: 0,
			payload: '',
			payloadFormat: 'markdown',
			visibility: { ui: 'always', prompt: true },
			ui: { rendererId: 'markdown' },
			prompt: { serializerId: 'asText' },
			lifespan: 'infinite',
			createdTurn: 0,
			source: 'llm',
		};
		const assistantReasoningPart: Part = {
			partId: prep.pendingAssistantReasoningPartId,
			channel: 'reasoning',
			order: -1,
			payload: '',
			payloadFormat: 'markdown',
			visibility: { ui: 'always', prompt: false },
			ui: { rendererId: 'markdown' },
			prompt: { serializerId: 'asText' },
			lifespan: 'infinite',
			createdTurn: 0,
			source: 'llm',
		};

		const userEntry = makeLocalVariant({
			entryId: prep.pendingUserEntryId,
			role: prep.role,
			createdAt: now,
			parts: [userPart],
		});
		const assistantEntry = makeLocalVariant({
			entryId: prep.pendingAssistantEntryId,
			role: 'assistant',
			createdAt: now + 1,
			parts: [assistantReasoningPart, assistantPart],
		});

		// Fill correct chatId/branchId in optimistic entries (for debugging).
		if (chat?.id && branchId) {
			userEntry.entry.chatId = chat.id;
			userEntry.entry.branchId = branchId;
			assistantEntry.entry.chatId = chat.id;
			assistantEntry.entry.branchId = branchId;
		}

		return [...entries, userEntry, assistantEntry];
	},
	target: $entries,
});

// Optimistic insert: assistant placeholder only (continue from last user turn).
sample({
	clock: prepareContinueFx.doneData,
	source: { entries: $entries, chat: $currentChat, branchId: $currentBranchId },
	fn: ({ entries, chat, branchId }, prep) => {
		const now = Date.now();
		const assistantPart: Part = {
			partId: prep.pendingAssistantMainPartId,
			channel: 'main',
			order: 0,
			payload: '',
			payloadFormat: 'markdown',
			visibility: { ui: 'always', prompt: true },
			ui: { rendererId: 'markdown' },
			prompt: { serializerId: 'asText' },
			lifespan: 'infinite',
			createdTurn: 0,
			source: 'llm',
		};
		const assistantReasoningPart: Part = {
			partId: prep.pendingAssistantReasoningPartId,
			channel: 'reasoning',
			order: -1,
			payload: '',
			payloadFormat: 'markdown',
			visibility: { ui: 'always', prompt: false },
			ui: { rendererId: 'markdown' },
			prompt: { serializerId: 'asText' },
			lifespan: 'infinite',
			createdTurn: 0,
			source: 'llm',
		};
		const assistantEntry = makeLocalVariant({
			entryId: prep.pendingAssistantEntryId,
			role: 'assistant',
			createdAt: now,
			parts: [assistantReasoningPart, assistantPart],
		});

		if (chat?.id && branchId) {
			assistantEntry.entry.chatId = chat.id;
			assistantEntry.entry.branchId = branchId;
		}

		return [...entries, assistantEntry];
	},
	target: $entries,
});

export const handleSseEnvelope = createEvent<SseEnvelope>();

type StreamDoneStatus = 'done' | 'aborted' | 'error';

type StreamTerminalState = {
	doneStatus: StreamDoneStatus | null;
	errorMessage: string | null;
};

function readStreamDoneStatus(env: SseEnvelope): StreamDoneStatus | null {
	if (env.type !== 'llm.stream.done') return null;
	const data = isRecord(env.data) ? env.data : null;
	const status = typeof data?.status === 'string' ? data.status : '';
	if (status === 'done' || status === 'aborted' || status === 'error') return status;
	return null;
}

function readStreamErrorMessage(env: SseEnvelope): string | null {
	if (env.type !== 'llm.stream.error') return null;
	const data = isRecord(env.data) ? env.data : null;
	const message = typeof data?.message === 'string' ? data.message.trim() : '';
	return message.length > 0 ? message : null;
}

function reduceStreamTerminalState(current: StreamTerminalState, env: SseEnvelope): StreamTerminalState {
	const doneStatus = readStreamDoneStatus(env) ?? current.doneStatus;
	const errorMessage = readStreamErrorMessage(env) ?? current.errorMessage;
	if (doneStatus === current.doneStatus && errorMessage === current.errorMessage) return current;
	return { doneStatus, errorMessage };
}

function shouldStopStreamingLoop(env: SseEnvelope): boolean {
	if (env.type === 'llm.stream.error') return true;
	const doneStatus = readStreamDoneStatus(env);
	return doneStatus === 'done' || doneStatus === 'aborted';
}

function buildStreamTerminalError(state: StreamTerminalState, fallbackMessage: string): Error | null {
	if (state.doneStatus === 'aborted') return null;
	if (state.doneStatus !== 'error' && !state.errorMessage) return null;
	return new Error(state.errorMessage ?? fallbackMessage);
}

export const runSendStreamFx = createEffect(async (prep: LocalPrep): Promise<void> => {
	let terminalState: StreamTerminalState = { doneStatus: null, errorMessage: null };
	let streamFailed: unknown = null;

	try {
		for await (const env of streamChatEntry({
			chatId: prep.chatId,
			branchId: prep.branchId,
			role: prep.role,
			content: prep.promptText,
			settings: {},
			signal: prep.controller.signal,
		})) {
			logChatGenerationSseEvent({ scope: 'entry-parts', envelope: env });
			handleSseEnvelope(env);
			terminalState = reduceStreamTerminalState(terminalState, env);
			if (shouldStopStreamingLoop(env)) break;
		}
	} catch (error) {
		if (isAbortLikeError(error)) {
			terminalState = { ...terminalState, doneStatus: 'aborted' };
		} else {
			streamFailed = error;
		}
	}

	// Final sync from server to ensure canonical state.
	await loadEntriesFx({ chatId: prep.chatId, branchId: prep.branchId });
	if (streamFailed) throw streamFailed;
	const terminalError = buildStreamTerminalError(terminalState, i18n.t('chat.toasts.streamError'));
	if (terminalError) throw terminalError;
});

export const runContinueStreamFx = createEffect(async (prep: ContinuePrep): Promise<void> => {
	let terminalState: StreamTerminalState = { doneStatus: null, errorMessage: null };
	let streamFailed: unknown = null;

	try {
		for await (const env of streamContinueEntry({
			chatId: prep.chatId,
			branchId: prep.branchId,
			settings: {},
			signal: prep.controller.signal,
		})) {
			logChatGenerationSseEvent({ scope: 'entry-parts', envelope: env });
			handleSseEnvelope(env);
			terminalState = reduceStreamTerminalState(terminalState, env);
			if (shouldStopStreamingLoop(env)) break;
		}
	} catch (error) {
		if (isAbortLikeError(error)) {
			terminalState = { ...terminalState, doneStatus: 'aborted' };
		} else {
			streamFailed = error;
		}
	}

	await loadEntriesFx({ chatId: prep.chatId, branchId: prep.branchId });
	if (streamFailed) throw streamFailed;
	const terminalError = buildStreamTerminalError(terminalState, i18n.t('chat.toasts.streamError'));
	if (terminalError) throw terminalError;
});

// Track active stream state for abort button
$activeStream.on(prepareSendFx.doneData, (_, prep) => ({
	controller: prep.controller,
	chatId: prep.chatId,
	branchId: prep.branchId,
	mode: 'send',
	pendingUserEntryId: prep.pendingUserEntryId,
	pendingUserMainPartId: prep.pendingUserMainPartId,
	pendingAssistantEntryId: prep.pendingAssistantEntryId,
	pendingAssistantMainPartId: prep.pendingAssistantMainPartId,
	pendingAssistantReasoningPartId: prep.pendingAssistantReasoningPartId,
}));

$activeStream.on(prepareContinueFx.doneData, (_, prep) => ({
	controller: prep.controller,
	chatId: prep.chatId,
	branchId: prep.branchId,
	mode: 'continue',
	pendingAssistantEntryId: prep.pendingAssistantEntryId,
	pendingAssistantMainPartId: prep.pendingAssistantMainPartId,
	pendingAssistantReasoningPartId: prep.pendingAssistantReasoningPartId,
}));

sample({
	clock: prepareSendFx.doneData,
	target: runSendStreamFx,
});

sample({
	clock: prepareContinueFx.doneData,
	target: runContinueStreamFx,
});

// Roll back optimistic user/assistant placeholders if stream fails before final sync.
type StreamPatch = {
	entries: ChatEntryWithVariantDto[];
	stream: ActiveStreamState | null;
	generationId?: string | null;
};

const applyStreamPatch = createEvent<StreamPatch>();
$entries.on(applyStreamPatch, (_, p) => p.entries);
$activeStream.on(applyStreamPatch, (_, p) => p.stream);
$activeGenerationId.on(applyStreamPatch, (prev, p) => (typeof p.generationId === 'undefined' ? prev : p.generationId));

function appendDeltaToPart(part: Part, delta: string): Part {
	const prev = typeof part.payload === 'string' ? part.payload : '';
	return { ...part, payload: prev + delta };
}

function appendDeltaToEntryPart(params: {
	entries: ChatEntryWithVariantDto[];
	entryId: string;
	partId: string;
	delta: string;
}): ChatEntryWithVariantDto[] {
	const entryIndex = params.entries.findIndex((item) => item.entry.entryId === params.entryId);
	if (entryIndex < 0) return params.entries;

	const target = params.entries[entryIndex];
	if (!target?.variant) return params.entries;

	const parts = target.variant.parts ?? [];
	const partIndex = parts.findIndex((part) => part.partId === params.partId);
	if (partIndex < 0) return params.entries;

	const currentPart = parts[partIndex];
	const nextPart = appendDeltaToPart(currentPart, params.delta);
	if (nextPart.payload === currentPart.payload) return params.entries;

	const nextParts = [...parts];
	nextParts[partIndex] = nextPart;

	const nextEntries = [...params.entries];
	nextEntries[entryIndex] = {
		...target,
		variant: {
			...target.variant,
			parts: nextParts,
		},
	};

	return nextEntries;
}

function appendCanonicalizationTag(tags: string[] | undefined): string[] {
	const next = Array.isArray(tags) ? [...tags] : [];
	if (!next.includes('canonicalization')) next.push('canonicalization');
	return next;
}

function applyUserCanonicalizationPatch(params: {
	entries: ChatEntryWithVariantDto[];
	entryId: string;
	replacedPartId: string;
	canonicalPartId: string;
	afterText: string;
}): ChatEntryWithVariantDto[] {
	const entryIndex = params.entries.findIndex((item) => item.entry.entryId === params.entryId);
	if (entryIndex < 0) return params.entries;
	const target = params.entries[entryIndex];
	if (!target?.variant) return params.entries;

	const parts = target.variant.parts ?? [];
	let partIndex = parts.findIndex((part) => part.partId === params.canonicalPartId);
	if (partIndex < 0) partIndex = parts.findIndex((part) => part.partId === params.replacedPartId);
	if (partIndex < 0) {
		for (let idx = parts.length - 1; idx >= 0; idx -= 1) {
			const candidate = parts[idx];
			if (!candidate || candidate.softDeleted || candidate.channel !== 'main') continue;
			partIndex = idx;
			break;
		}
	}
	if (partIndex < 0) return params.entries;

	const previousPart = parts[partIndex];
	if (!previousPart) return params.entries;

	const nextPart: Part = {
		...previousPart,
		partId: params.canonicalPartId,
		payload: params.afterText,
		source: 'agent',
		replacesPartId: params.replacedPartId,
		tags: appendCanonicalizationTag(previousPart.tags),
	};

	const changed =
		nextPart.partId !== previousPart.partId ||
		nextPart.payload !== previousPart.payload ||
		nextPart.source !== previousPart.source ||
		nextPart.replacesPartId !== previousPart.replacesPartId ||
		(nextPart.tags ?? []).join('|') !== (previousPart.tags ?? []).join('|');
	if (!changed) return params.entries;

	const nextParts = [...parts];
	nextParts[partIndex] = nextPart;

	const nextEntries = [...params.entries];
	nextEntries[entryIndex] = {
		...target,
		variant: {
			...target.variant,
			parts: nextParts,
		},
	};
	return nextEntries;
}

function buildStreamingMainPart(seed: Part | undefined, partId: string): Part {
	if (seed) {
		return {
			...seed,
			partId,
			payload: '',
			source: 'llm',
		};
	}
	return {
		partId,
		channel: 'main',
		order: 0,
		payload: '',
		payloadFormat: 'markdown',
		visibility: { ui: 'always', prompt: true },
		ui: { rendererId: 'markdown' },
		prompt: { serializerId: 'asText' },
		lifespan: 'infinite',
		createdTurn: 0,
		source: 'llm',
	};
}

function buildStreamingReasoningPart(seed: Part | undefined, partId: string): Part {
	if (seed) {
		return {
			...seed,
			partId,
			payload: '',
			source: 'llm',
			channel: 'reasoning',
			visibility: { ui: 'always', prompt: false },
		};
	}
	return {
		partId,
		channel: 'reasoning',
		order: -1,
		payload: '',
		payloadFormat: 'markdown',
		visibility: { ui: 'always', prompt: false },
		ui: { rendererId: 'markdown' },
		prompt: { serializerId: 'asText' },
		lifespan: 'infinite',
		createdTurn: 0,
		source: 'llm',
	};
}

function replaceIdsOnMeta(entries: ChatEntryWithVariantDto[], stream: ActiveStreamState, meta: any): { entries: ChatEntryWithVariantDto[]; stream: ActiveStreamState; generationId: string | null } {
	const clearOptimisticMeta = (entryMeta: unknown): unknown => {
		if (!entryMeta || typeof entryMeta !== 'object') return entryMeta;
		const obj = entryMeta as Record<string, unknown>;
		if (!Object.prototype.hasOwnProperty.call(obj, 'optimistic')) return entryMeta;
		const next = { ...obj };
		delete next.optimistic;
		return next;
	};

	const userEntryId = typeof meta?.userEntryId === 'string' ? meta.userEntryId : null;
	const userMainPartId = typeof meta?.userMainPartId === 'string' ? meta.userMainPartId : null;
	const resolvedUserMainPartId = stream.userMainPartId ?? userMainPartId;
	const userRenderedContent = typeof meta?.userRenderedContent === 'string' ? meta.userRenderedContent : null;
	const assistantEntryId = typeof meta?.assistantEntryId === 'string' ? meta.assistantEntryId : null;
	const assistantVariantId = typeof meta?.assistantVariantId === 'string' ? meta.assistantVariantId : null;
	const assistantMainPartId = typeof meta?.assistantMainPartId === 'string' ? meta.assistantMainPartId : null;
	const assistantReasoningPartId = typeof meta?.assistantReasoningPartId === 'string' ? meta.assistantReasoningPartId : null;
	const generationId = typeof meta?.generationId === 'string' ? meta.generationId : null;

	const nextEntries = entries.map((x) => {
		// Replace optimistic ids
		if (stream.mode === 'send') {
			if (x.entry.entryId === stream.pendingUserEntryId && userEntryId) {
				const nextVariant = x.variant
					? {
							...x.variant,
							entryId: userEntryId,
							parts: (x.variant.parts ?? []).map((p) => {
								if (p.partId === stream.pendingUserMainPartId) {
									return {
										...p,
										partId: resolvedUserMainPartId ?? p.partId,
										payload: userRenderedContent ?? p.payload,
									};
								}
								return p;
							}),
						}
					: x.variant;
				return {
					...x,
					entry: { ...x.entry, entryId: userEntryId, meta: clearOptimisticMeta(x.entry.meta) as typeof x.entry.meta },
					variant: nextVariant,
				};
			}
			if (x.entry.entryId === stream.pendingAssistantEntryId && assistantEntryId) {
				const nextVariant = x.variant
					? {
							...x.variant,
							variantId: assistantVariantId ?? x.variant.variantId,
							entryId: assistantEntryId,
							parts: (x.variant.parts ?? []).map((p) =>
								p.partId === stream.pendingAssistantMainPartId && assistantMainPartId
									? { ...p, partId: assistantMainPartId }
									: p.partId === stream.pendingAssistantReasoningPartId && assistantReasoningPartId
										? { ...p, partId: assistantReasoningPartId }
										: p,
							),
						}
					: x.variant;
				return {
					...x,
					entry: {
						...x.entry,
						entryId: assistantEntryId,
						activeVariantId: assistantVariantId ?? x.entry.activeVariantId,
						meta: clearOptimisticMeta(x.entry.meta) as typeof x.entry.meta,
					},
					variant: nextVariant,
				};
			}
		}
		if (stream.mode === 'continue' && x.entry.entryId === stream.pendingAssistantEntryId && assistantEntryId) {
			const nextVariant = x.variant
				? {
						...x.variant,
						variantId: assistantVariantId ?? x.variant.variantId,
						entryId: assistantEntryId,
						parts: (x.variant.parts ?? []).map((p) =>
							p.partId === stream.pendingAssistantMainPartId && assistantMainPartId
								? { ...p, partId: assistantMainPartId }
								: p.partId === stream.pendingAssistantReasoningPartId && assistantReasoningPartId
									? { ...p, partId: assistantReasoningPartId }
									: p,
						),
					}
				: x.variant;
			return {
				...x,
				entry: {
					...x.entry,
					entryId: assistantEntryId,
					activeVariantId: assistantVariantId ?? x.entry.activeVariantId,
					meta: clearOptimisticMeta(x.entry.meta) as typeof x.entry.meta,
				},
				variant: nextVariant,
			};
		}
		if (stream.mode === 'regenerate' && assistantEntryId && x.entry.entryId === assistantEntryId) {
			const nextVariantId = assistantVariantId ?? x.entry.activeVariantId;
			const nextPartId = assistantMainPartId ?? stream.assistantMainPartId ?? `local_part_${nowIso()}`;
			const nextReasoningPartId = assistantReasoningPartId ?? stream.assistantReasoningPartId ?? `local_part_${nowIso()}`;
			const currentVariant = x.variant;
			const currentMainPart =
				currentVariant?.parts?.find((p) => p.channel === 'main' && !p.softDeleted) ?? currentVariant?.parts?.[0];
			const currentReasoningPart = currentVariant?.parts?.find((p) => p.channel === 'reasoning' && !p.softDeleted);

			let nextVariant = currentVariant;
			if (!nextVariant || nextVariant.variantId !== nextVariantId) {
				nextVariant = {
					variantId: nextVariantId,
					entryId: assistantEntryId,
					kind: 'generation',
					createdAt: Date.now(),
					parts: [
						buildStreamingReasoningPart(currentReasoningPart, nextReasoningPartId),
						buildStreamingMainPart(currentMainPart, nextPartId),
					],
				};
			} else {
				let mainReplaced = false;
				let reasoningReplaced = false;
				const nextParts = (nextVariant.parts ?? []).map((p) => {
					if (p.channel === 'main' && !p.softDeleted && !mainReplaced) {
						mainReplaced = true;
						return { ...p, partId: nextPartId, payload: '' };
					}
					if (p.channel === 'reasoning' && !p.softDeleted && !reasoningReplaced) {
						reasoningReplaced = true;
						return { ...p, partId: nextReasoningPartId, payload: '' };
					}
					return p;
				});
				const withReasoning = reasoningReplaced
					? nextParts
					: [buildStreamingReasoningPart(currentReasoningPart, nextReasoningPartId), ...nextParts];
				nextVariant = {
					...nextVariant,
					parts: mainReplaced ? withReasoning : [buildStreamingMainPart(currentMainPart, nextPartId), ...withReasoning],
				};
			}

			return {
				...x,
				entry: { ...x.entry, activeVariantId: nextVariantId },
				variant: nextVariant,
			};
		}
		return x;
	});

	return {
		entries: nextEntries,
		stream: {
			...stream,
			userMainPartId: resolvedUserMainPartId ?? undefined,
			assistantEntryId: assistantEntryId ?? stream.assistantEntryId,
			assistantMainPartId: assistantMainPartId ?? stream.assistantMainPartId,
			assistantReasoningPartId: assistantReasoningPartId ?? stream.assistantReasoningPartId,
			generationId: generationId ?? stream.generationId,
		},
		generationId,
	};
}

sample({
	clock: handleSseEnvelope,
	source: { entries: $entries, stream: $activeStream, generationId: $activeGenerationId },
	fn: ({ entries, stream }, env) => {
		if (env.type === 'turn.assistant.canonicalized') {
			const data = isRecord(env.data) ? env.data : null;
			const assistantEntryId = typeof data?.assistantEntryId === 'string' ? data.assistantEntryId : null;
			const assistantMainPartId = typeof data?.assistantMainPartId === 'string' ? data.assistantMainPartId : null;
			const afterText = typeof data?.afterText === 'string' ? data.afterText : null;
			if (!assistantEntryId || !assistantMainPartId || afterText === null) {
				return { entries, stream };
			}

			return {
				entries: applyAssistantCanonicalizationPatch({
					entries,
					entryId: assistantEntryId,
					partId: assistantMainPartId,
					afterText,
				}),
				stream,
			};
		}

		if (env.type === 'turn.user.canonicalized') {
			const data = env.data as Record<string, unknown> | null;
			const userEntryId = data && typeof data.userEntryId === 'string' ? data.userEntryId : null;
			const replacedPartId = data && typeof data.replacedPartId === 'string' ? data.replacedPartId : null;
			const canonicalPartId = data && typeof data.canonicalPartId === 'string' ? data.canonicalPartId : null;
			const afterText = data && typeof data.afterText === 'string' ? data.afterText : null;
			if (!userEntryId || !replacedPartId || !canonicalPartId || afterText === null) {
				return { entries, stream };
			}

			const fallbackEntryId =
				stream?.mode === 'send' && stream.pendingUserEntryId ? stream.pendingUserEntryId : userEntryId;
			let nextEntries = applyUserCanonicalizationPatch({
				entries,
				entryId: userEntryId,
				replacedPartId,
				canonicalPartId,
				afterText,
			});
			if (nextEntries === entries && fallbackEntryId !== userEntryId) {
				nextEntries = applyUserCanonicalizationPatch({
					entries,
					entryId: fallbackEntryId,
					replacedPartId,
					canonicalPartId,
					afterText,
				});
			}

			if (!stream) return { entries: nextEntries, stream };
			return {
				entries: nextEntries,
				stream: {
					...stream,
					userMainPartId: canonicalPartId,
				},
			};
		}

		if (!stream) return { entries, stream, generationId: null };

		if (env.type === 'llm.stream.meta') {
			const meta = env.data as any;
			return replaceIdsOnMeta(entries, stream, meta);
		}

		if (env.type === 'llm.stream.delta') {
			const delta = env.data as any;
			const content = typeof delta?.content === 'string' ? delta.content : '';
			if (!content) return { entries, stream };

			const assistantEntryId = stream.assistantEntryId ?? stream.pendingAssistantEntryId ?? null;
			const partId = stream.assistantMainPartId ?? stream.pendingAssistantMainPartId ?? null;
			if (!assistantEntryId || !partId) return { entries, stream };

			const nextEntries = appendDeltaToEntryPart({
				entries,
				entryId: assistantEntryId,
				partId,
				delta: content,
			});

			return { entries: nextEntries, stream };
		}

		if (env.type === 'llm.stream.reasoning_delta') {
			const delta = env.data as any;
			const content = typeof delta?.content === 'string' ? delta.content : '';
			if (!content) return { entries, stream };

			const assistantEntryId = stream.assistantEntryId ?? stream.pendingAssistantEntryId ?? null;
			const partId = stream.assistantReasoningPartId ?? stream.pendingAssistantReasoningPartId ?? null;
			if (!assistantEntryId || !partId) return { entries, stream };

			const nextEntries = appendDeltaToEntryPart({
				entries,
				entryId: assistantEntryId,
				partId,
				delta: content,
			});

			return { entries: nextEntries, stream };
		}

		if (env.type === 'llm.stream.done') {
			return { entries, stream: null, generationId: null };
		}

		return { entries, stream };
	},
	target: applyStreamPatch,
});

// Per-operation progress lives in the "Запуск" tab of the operations sidebar
// (model/operation-run-trace); toasts stay only for failures.
handleSseEnvelope.watch((env) => {
	if (env.type !== 'operation.finished') return;
	const failure = readOperationFinishedFailure(env.data);
	if (!failure) return;
	const interpolation = {
		name: failure.name ?? i18n.t('chat.toasts.operationFallbackName'),
		hook: failure.hook ?? i18n.t('chat.toasts.operationFallbackHook'),
	};

	if (failure.status === 'aborted') {
		toaster.error({
			title: i18n.t('chat.toasts.operationFinishedAborted', interpolation),
			description: failure.errorMessage ?? undefined,
		});
		return;
	}
	toaster.error({
		title: i18n.t('chat.toasts.operationFinishedError', interpolation),
		description: failure.errorMessage ?? undefined,
	});
});

export const abortGenerationFx = createEffect(async (params: { generationId: string }) => abortGeneration(params.generationId));

export const doAbort = createEvent<{ stream: ActiveStreamState | null; generationId: string | null }>();

sample({
	clock: abortRequested,
	source: { stream: $activeStream, generationId: $activeGenerationId },
	filter: ({ stream, generationId }) => Boolean(stream || generationId),
	fn: ({ stream, generationId }) => ({ stream, generationId }),
	target: doAbort,
});

doAbort.watch(({ stream, generationId }) => {
	const keepRegenerateStreamOpen = Boolean(stream && stream.mode === 'regenerate' && generationId);
	if (stream && !keepRegenerateStreamOpen) stream.controller.abort();
	if (generationId) void abortGenerationFx({ generationId });
});

$isChatStreaming
	.on(runSendStreamFx, () => true)
	.on(runSendStreamFx.finally, () => false)
	.on(runContinueStreamFx, () => true)
	.on(runContinueStreamFx.finally, () => false);

// ---- Variants (entry-level)

export const loadVariantsFx = createEffect(async (params: { entryId: string }) => {
	const variants = await listEntryVariants(params.entryId);
	return { entryId: params.entryId, variants };
});

export const $variantsByEntryId = createStore<Record<string, Variant[]>>({}).on(loadVariantsFx.doneData, (prev, { entryId, variants }) => ({
	...prev,
	[entryId]: variants,
}));

export const loadVariantsRequested = createEvent<{ entryId: string }>();
export const $variantsLoadingByEntryId = createStore<Record<string, boolean>>({})
	.on(loadVariantsFx, (prev, { entryId }) => ({ ...prev, [entryId]: true }))
	.on(loadVariantsFx.doneData, (prev, { entryId }) => ({ ...prev, [entryId]: false }))
	.on(loadVariantsFx.fail, (prev, { params }) => ({ ...prev, [params.entryId]: false }));

sample({
	clock: refreshVariantsAfterUndo,
	target: loadVariantsRequested,
});

sample({
	clock: refreshVariantsAfterPartBatchUpdate,
	target: loadVariantsRequested,
});

sample({
	clock: loadVariantsRequested,
	source: $variantsLoadingByEntryId,
	filter: (loadingById, { entryId }) => !loadingById[entryId],
	fn: (_loadingById, payload) => payload,
	target: loadVariantsFx,
});

export const selectVariantRequested = createEvent<{ entryId: string; variantId: string }>();
export const selectVariantFx = createEffect(async (params: { entryId: string; variantId: string }) => selectEntryVariant(params));

const applyVariantSelectionOptimistic = createEvent<{ entryId: string; variantId: string; variant: Variant | null }>();

$entries.on(applyVariantSelectionOptimistic, (entries, payload) =>
	entries.map((item) =>
		item.entry.entryId !== payload.entryId
			? item
			: {
					...item,
					entry: { ...item.entry, activeVariantId: payload.variantId },
					variant: payload.variant ?? item.variant,
				},
	),
);

sample({
	clock: selectVariantRequested,
	source: $variantsByEntryId,
	fn: (variantsByEntryId, payload) => ({
		entryId: payload.entryId,
		variantId: payload.variantId,
		variant: (variantsByEntryId[payload.entryId] ?? []).find((v) => v.variantId === payload.variantId) ?? null,
	}),
	target: applyVariantSelectionOptimistic,
});

sample({ clock: selectVariantRequested, target: selectVariantFx });

sample({
	clock: selectVariantFx.failData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

selectVariantFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.switchVariantError'), description: error instanceof Error ? error.message : String(error) });
});

export const deleteVariantRequested = createEvent<{ entryId: string; variantId: string }>();
export const deleteVariantFx = createEffect(async (params: { entryId: string; variantId: string }) => deleteEntryVariant(params));

sample({ clock: deleteVariantRequested, target: deleteVariantFx });

sample({
	clock: deleteVariantFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

sample({
	clock: deleteVariantFx.doneData,
	fn: ({ entryId }) => ({ entryId }),
	target: loadVariantsRequested,
});

deleteVariantFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('chat.toasts.variantDeleted') });
});

deleteVariantFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.deleteVariantError'), description: error instanceof Error ? error.message : String(error) });
});

export type EntryPartEditState = {
	partId: string;
	draftText: string;
};

function omitEntryEdit(
	state: Record<string, EntryPartEditState>,
	entryId: string,
): Record<string, EntryPartEditState> {
	if (!state[entryId]) return state;
	const next = { ...state };
	delete next[entryId];
	return next;
}

export const openEntryPartEditRequested = createEvent<{ entryId: string; partId: string; draftText: string }>();
export const updateEntryPartDraftRequested = createEvent<{ entryId: string; draftText: string }>();
export const closeEntryPartEditRequested = createEvent<{ entryId: string }>();
export const clearEntryPartEditsRequested = createEvent();

export const $entryPartEdits = createStore<Record<string, EntryPartEditState>>({})
	.on(openEntryPartEditRequested, (state, payload) => ({
		...state,
		[payload.entryId]: { partId: payload.partId, draftText: payload.draftText },
	}))
	.on(updateEntryPartDraftRequested, (state, payload) => {
		const current = state[payload.entryId];
		if (!current) return state;
		return {
			...state,
			[payload.entryId]: {
				...current,
				draftText: payload.draftText,
			},
		};
	})
	.on(closeEntryPartEditRequested, (state, payload) => omitEntryEdit(state, payload.entryId))
	.on(clearEntryPartEditsRequested, () => ({}))
	.on(enterBulkDeleteMode, () => ({}))
	.on(setOpenedChat, () => ({}));

export const manualEditEntryRequested = createEvent<{ entryId: string; content: string; partId?: string }>();
export const manualEditEntryFx = createEffect(async (params: { entryId: string; content: string; partId?: string }) => {
	return manualEditEntry(params);
});

sample({ clock: manualEditEntryRequested, target: manualEditEntryFx });

sample({
	clock: manualEditEntryFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

sample({
	clock: manualEditEntryFx.doneData,
	fn: ({ entryId }) => ({ entryId }),
	target: loadVariantsRequested,
});

sample({
	clock: manualEditEntryFx.doneData,
	fn: ({ entryId }) => ({ entryId }),
	target: closeEntryPartEditRequested,
});

manualEditEntryFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('chat.toasts.variantSaved') });
});

manualEditEntryFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.saveEditError'), description: error instanceof Error ? error.message : String(error) });
});

export const softDeleteEntryRequested = createEvent<{ entryId: string }>();
export const softDeleteEntryFx = createEffect(async (params: { entryId: string }) => softDeleteEntry(params.entryId));
export const softDeleteEntriesBulkRequested = createEvent<{ entryIds: string[] }>();
export const softDeleteEntriesBulkFx = createEffect(async (params: { entryIds: string[] }) => softDeleteEntriesBulk(params.entryIds));
export const softDeletePartRequested = createEvent<{ entryId: string; partId: string }>();
export const softDeletePartFx = createEffect(async (params: { entryId: string; partId: string }) => {
	await softDeletePart(params.partId);
	return params;
});
export const setEntryPromptVisibilityRequested = createEvent<{ entryId: string; includeInPrompt: boolean }>();
export const setEntryPromptVisibilityFx = createEffect(async (params: { entryId: string; includeInPrompt: boolean }) => {
	return setEntryPromptVisibility(params);
});

const applyEntryPromptVisibilityOptimistic = createEvent<{ entryId: string; includeInPrompt: boolean }>();

$entries.on(applyEntryPromptVisibilityOptimistic, (entries, payload) =>
	entries.map((item) => {
		if (item.entry.entryId !== payload.entryId) return item;
		const meta = isRecord(item.entry.meta) ? { ...item.entry.meta } : {};
		if (payload.includeInPrompt) {
			delete meta.excludedFromPrompt;
		} else {
			meta.excludedFromPrompt = true;
		}
		return {
			...item,
			entry: {
				...item.entry,
				meta,
			},
		};
	}),
);

sample({ clock: softDeleteEntryRequested, target: softDeleteEntryFx });
sample({
	clock: softDeleteEntriesBulkRequested,
	filter: ({ entryIds }) => entryIds.length > 0,
	target: softDeleteEntriesBulkFx,
});
sample({ clock: softDeletePartRequested, target: softDeletePartFx });
sample({ clock: setEntryPromptVisibilityRequested, target: applyEntryPromptVisibilityOptimistic });
sample({ clock: setEntryPromptVisibilityRequested, target: setEntryPromptVisibilityFx });

sample({
	clock: softDeleteEntryFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

softDeleteEntryFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('chat.toasts.messageDeleted') });
});

softDeleteEntryFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.deleteMessageError'), description: error instanceof Error ? error.message : String(error) });
});

sample({
	clock: softDeletePartFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

sample({
	clock: softDeletePartFx.doneData,
	fn: ({ entryId }) => ({ entryId }),
	target: loadVariantsRequested,
});

sample({
	clock: softDeleteEntriesBulkFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

sample({
	clock: softDeleteEntriesBulkFx.doneData,
	target: [exitBulkDeleteMode, clearBulkDeleteSelection],
});

sample({
	clock: setEntryPromptVisibilityFx.failData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

softDeletePartFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('chat.toasts.partDeleted') });
});

softDeletePartFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.deletePartError'), description: error instanceof Error ? error.message : String(error) });
});

softDeleteEntriesBulkFx.doneData.watch((result) => {
	toaster.success({ title: i18n.t('chat.toasts.bulkMessagesDeleted', { count: result.ids.length }) });
});

softDeleteEntriesBulkFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.bulkDeleteMessageError'), description: error instanceof Error ? error.message : String(error) });
});

setEntryPromptVisibilityFx.done.watch(({ params }) => {
	toaster.success({
		title: params.includeInPrompt ? i18n.t('chat.toasts.messageShownInPrompt') : i18n.t('chat.toasts.messageHiddenFromPrompt'),
	});
});

setEntryPromptVisibilityFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('chat.toasts.togglePromptVisibilityError'),
		description: error instanceof Error ? error.message : String(error),
	});
});

batchUpdateEntryPartsFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('chat.toasts.partsBatchSaved') });
});

batchUpdateEntryPartsFx.failData.watch((error) => {
	const status = readHttpStatus(error);
	if (status === 409) {
		toaster.error({
			title: i18n.t('chat.toasts.partsBatchConflictTitle'),
			description: i18n.t('chat.toasts.partsBatchConflictDescription'),
		});
		return;
	}
	toaster.error({
		title: i18n.t('chat.toasts.partsBatchSaveError'),
		description: error instanceof Error ? error.message : String(error),
	});
});

undoCanonicalizationFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('chat.toasts.canonicalizationUndone') });
});

undoCanonicalizationFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('chat.toasts.undoCanonicalizationError'),
		description: error instanceof Error ? error.message : String(error),
	});
});

export type DeleteConfirmState =
	| { kind: 'entry'; entryId: string }
	| { kind: 'variant'; entryId: string; variantId: string }
	| { kind: 'part'; entryId: string; partId: string }
	| { kind: 'bulkEntries'; entryIds: string[]; count: number }
	| null;

export const openDeleteEntryConfirm = createEvent<{ entryId: string }>();
export const openDeleteVariantConfirm = createEvent<{ entryId: string; variantId: string }>();
export const openDeletePartConfirm = createEvent<{ entryId: string; partId: string }>();
export const openBulkDeleteConfirm = createEvent();
const openBulkDeleteConfirmResolved = createEvent<{ entryIds: string[]; count: number }>();
export const closeDeleteConfirm = createEvent();
export const confirmDeleteAction = createEvent();

export const $deleteConfirmState = createStore<DeleteConfirmState>(null)
	.on(openDeleteEntryConfirm, (_prev, payload) => ({ kind: 'entry', ...payload }))
	.on(openDeleteVariantConfirm, (_prev, payload) => ({ kind: 'variant', ...payload }))
	.on(openDeletePartConfirm, (_prev, payload) => ({ kind: 'part', ...payload }))
	.on(openBulkDeleteConfirmResolved, (_prev, payload) => ({ kind: 'bulkEntries', ...payload }))
	.on(closeDeleteConfirm, () => null);

sample({
	clock: openBulkDeleteConfirm,
	source: $bulkDeleteSelectedEntryIds,
	filter: (entryIds) => entryIds.length > 0,
	fn: (entryIds) => ({ entryIds, count: entryIds.length }),
	target: openBulkDeleteConfirmResolved,
});

sample({
	clock: confirmDeleteAction,
	source: $deleteConfirmState,
	filter: (state): state is Extract<NonNullable<DeleteConfirmState>, { kind: 'entry' }> => state?.kind === 'entry',
	fn: (state) => ({ entryId: (state as Extract<NonNullable<DeleteConfirmState>, { kind: 'entry' }>).entryId }),
	target: softDeleteEntryRequested,
});

sample({
	clock: confirmDeleteAction,
	source: $deleteConfirmState,
	filter: (state): state is Extract<NonNullable<DeleteConfirmState>, { kind: 'variant' }> => state?.kind === 'variant',
	fn: (state) => ({
		entryId: (state as Extract<NonNullable<DeleteConfirmState>, { kind: 'variant' }>).entryId,
		variantId: (state as Extract<NonNullable<DeleteConfirmState>, { kind: 'variant' }>).variantId,
	}),
	target: deleteVariantRequested,
});

sample({
	clock: confirmDeleteAction,
	source: $deleteConfirmState,
	filter: (state): state is Extract<NonNullable<DeleteConfirmState>, { kind: 'part' }> => state?.kind === 'part',
	fn: (state) => ({
		entryId: (state as Extract<NonNullable<DeleteConfirmState>, { kind: 'part' }>).entryId,
		partId: (state as Extract<NonNullable<DeleteConfirmState>, { kind: 'part' }>).partId,
	}),
	target: softDeletePartRequested,
});

sample({
	clock: confirmDeleteAction,
	source: $deleteConfirmState,
	filter: (state): state is Extract<NonNullable<DeleteConfirmState>, { kind: 'bulkEntries' }> => state?.kind === 'bulkEntries',
	fn: (state) => ({
		entryIds: (state as Extract<NonNullable<DeleteConfirmState>, { kind: 'bulkEntries' }>).entryIds,
	}),
	target: softDeleteEntriesBulkRequested,
});

sample({
	clock: confirmDeleteAction,
	target: closeDeleteConfirm,
});

export const regenerateRequested = createEvent<{ entryId: string }>();

export const prepareRegenerateFx = createEffect(async (params: { chatId: string; branchId: string; entryId: string }) => {
	const controller = new AbortController();
	return { controller, chatId: params.chatId, branchId: params.branchId, entryId: params.entryId, mode: 'regenerate' as const };
});

function isAbortLikeError(error: unknown): boolean {
	if (!error) return false;
	if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
		return error.name === 'AbortError';
	}
	if (error instanceof Error) {
		return error.name === 'AbortError';
	}
	return false;
}

function isVariantTextuallyEmpty(variant: Variant): boolean {
	const parts = (variant.parts ?? []).filter((p) => !p.softDeleted);
	if (parts.length === 0) return true;
	return parts.every((part) => {
		if (typeof part.payload !== 'string') return false;
		return part.payload.trim().length === 0;
	});
}

sample({
	clock: regenerateRequested,
	source: { chat: $currentChat, branchId: $currentBranchId, isStreaming: $isChatStreaming },
	filter: ({ chat, branchId, isStreaming }) => Boolean(chat?.id && branchId && !isStreaming),
	fn: ({ chat, branchId }, { entryId }) => ({ chatId: chat!.id, branchId: branchId!, entryId }),
	target: prepareRegenerateFx,
});

// Optimistic clear assistant main part before regenerate.
sample({
	clock: prepareRegenerateFx.doneData,
	source: $entries,
	fn: (entries, prep) =>
		entries.map((x) => {
			if (x.entry.entryId !== prep.entryId) return x;
			if (!x.variant) return x;
			return {
				...x,
				variant: {
					...x.variant,
					parts: (x.variant.parts ?? []).map((p) => (p.channel === 'main' ? { ...p, payload: '' } : p)),
				},
			};
		}),
	target: $entries,
});

$activeStream.on(prepareRegenerateFx.doneData, (_, prep) => ({
	controller: prep.controller,
	chatId: prep.chatId,
	branchId: prep.branchId,
	mode: 'regenerate',
	assistantEntryId: prep.entryId,
}));

export const runRegenerateStreamFx = createEffect(async (prep: Awaited<ReturnType<typeof prepareRegenerateFx>>): Promise<void> => {
	const baselineVariants = await listEntryVariants(prep.entryId).catch(() => []);
	const baselineVariantIds = new Set(baselineVariants.map((v) => v.variantId));

	let assistantVariantId: string | null = null;
	let sawFirstToken = false;
	let terminalState: StreamTerminalState = { doneStatus: null, errorMessage: null };
	let streamFailed: unknown = null;

	try {
		for await (const env of streamRegenerateEntry({
			entryId: prep.entryId,
			settings: {},
			signal: prep.controller.signal,
		})) {
			logChatGenerationSseEvent({ scope: 'entry-parts', envelope: env });
			handleSseEnvelope(env);
			terminalState = reduceStreamTerminalState(terminalState, env);

			if (env.type === 'llm.stream.meta') {
				const meta = env.data as Record<string, unknown> | null;
				const variantId = meta && typeof meta.assistantVariantId === 'string' ? meta.assistantVariantId : null;
				if (variantId) assistantVariantId = variantId;
			}

			if (env.type === 'llm.stream.delta' || env.type === 'llm.stream.reasoning_delta') {
				const data = env.data as Record<string, unknown> | null;
				const content = data && typeof data.content === 'string' ? data.content : '';
				if (content.length > 0) sawFirstToken = true;
			}

			if (shouldStopStreamingLoop(env)) break;
		}
	} catch (error) {
		if (isAbortLikeError(error)) {
			terminalState = { ...terminalState, doneStatus: 'aborted' };
		} else {
			streamFailed = error;
		}
	}

	// User aborted before first token: remove empty regeneration variant automatically.
	if (terminalState.doneStatus === 'aborted' && !sawFirstToken) {
		const cleanupCandidates: string[] = [];
		if (assistantVariantId) cleanupCandidates.push(assistantVariantId);

		const currentVariants = await listEntryVariants(prep.entryId).catch(() => []);
		for (const variant of currentVariants) {
			if (baselineVariantIds.has(variant.variantId)) continue;
			if (!isVariantTextuallyEmpty(variant)) continue;
			cleanupCandidates.push(variant.variantId);
		}

		for (const variantId of Array.from(new Set(cleanupCandidates))) {
			try {
				await deleteEntryVariant({ entryId: prep.entryId, variantId });
			} catch {
				// Ignore cleanup errors; canonical reload below keeps UI consistent.
			}
		}
	}

	await loadEntriesFx({ chatId: prep.chatId, branchId: prep.branchId });
	loadVariantsRequested({ entryId: prep.entryId });

	if (streamFailed) throw streamFailed;
	const terminalError = buildStreamTerminalError(terminalState, i18n.t('chat.toasts.regenerateError'));
	if (terminalError) throw terminalError;
});

sample({ clock: prepareRegenerateFx.doneData, target: runRegenerateStreamFx });

$activeStream.reset(runSendStreamFx.finally, runContinueStreamFx.finally, runRegenerateStreamFx.finally);
$activeGenerationId.reset(runSendStreamFx.finally, runContinueStreamFx.finally, runRegenerateStreamFx.finally);

$isChatStreaming.on(runRegenerateStreamFx, () => true).on(runRegenerateStreamFx.finally, () => false);

prepareSendFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.sendMessageError'), description: error instanceof Error ? error.message : String(error) });
});

runSendStreamFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.streamError'), description: error instanceof Error ? error.message : String(error) });
});

runContinueStreamFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.streamError'), description: error instanceof Error ? error.message : String(error) });
});

runRegenerateStreamFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.regenerateError'), description: error instanceof Error ? error.message : String(error) });
});
