import { createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';

import { abortGeneration } from '../../api/chat-core';
import {
	listChatEntries,
	listEntryVariants,
	manualEditEntry,
	selectEntryVariant,
	softDeleteEntry,
	streamChatEntry,
	streamRegenerateEntry,
} from '../../api/chat-entry-parts';
import i18n from '../../i18n';
import { $currentBranchId, $currentChat, setOpenedChat } from '../chat-core';
import { logChatGenerationSseEvent } from '../chat-generation-debug';

import type { SseEnvelope } from '../../api/chat-core';
import type { ChatEntryWithVariantDto } from '../../api/chat-entry-parts';
import type { Entry, Part, Variant } from '@shared/types/chat-entry-parts';

function nowIso(): string {
	return new Date().toISOString();
}

export const loadEntriesFx = createEffect(async (params: { chatId: string; branchId: string }) => {
	return listChatEntries({ chatId: params.chatId, branchId: params.branchId, limit: 200 });
});

export const $entries = createStore<ChatEntryWithVariantDto[]>([]).on(loadEntriesFx.doneData, (_, res) => res.entries);
export const $currentTurn = createStore<number>(0).on(loadEntriesFx.doneData, (_, res) => res.currentTurn);

loadEntriesFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.loadChatError'), description: error instanceof Error ? error.message : String(error) });
});

// Reload entries when we open a chat (chat-core still owns chat/branch selection).
sample({
	clock: setOpenedChat,
	fn: ({ chat, branchId }) => ({ chatId: chat.id, branchId }),
	target: loadEntriesFx,
});

export const $isChatStreaming = createStore(false);
export const $activeGenerationId = createStore<string | null>(null);

export const sendMessageRequested = createEvent<{ promptText: string; role?: 'user' | 'system' }>();
export const abortRequested = createEvent();

type ActiveStreamState = {
	controller: AbortController;
	chatId: string;
	branchId: string;
	mode: 'send' | 'regenerate';

	// Local optimistic ids
	pendingUserEntryId?: string;
	pendingAssistantEntryId?: string;
	pendingAssistantMainPartId?: string;

	// Server ids (learned from llm.stream.meta)
	assistantEntryId?: string;
	assistantMainPartId?: string;
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
	pendingAssistantEntryId: string;
	pendingAssistantMainPartId: string;
	mode: 'send';
};

export const prepareSendFx = createEffect(async (params: { chatId: string; branchId: string; role: 'user' | 'system'; promptText: string }) => {
	const controller = new AbortController();
	const pendingUserEntryId = `local_user_${nowIso()}`;
	const pendingAssistantEntryId = `local_assistant_${nowIso()}`;
	const pendingAssistantMainPartId = `local_part_${nowIso()}`;
	return {
		controller,
		chatId: params.chatId,
		branchId: params.branchId,
		role: params.role,
		promptText: params.promptText,
		pendingUserEntryId,
		pendingAssistantEntryId,
		pendingAssistantMainPartId,
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

function makeLocalVariantWithSingleMainPart(params: {
	entryId: string;
	role: Entry['role'];
	createdAt: number;
	mainPart: Part;
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
		parts: [params.mainPart],
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
			partId: `local_part_${nowIso()}`,
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

		const userEntry = makeLocalVariantWithSingleMainPart({
			entryId: prep.pendingUserEntryId,
			role: prep.role,
			createdAt: now,
			mainPart: userPart,
		});
		const assistantEntry = makeLocalVariantWithSingleMainPart({
			entryId: prep.pendingAssistantEntryId,
			role: 'assistant',
			createdAt: now + 1,
			mainPart: assistantPart,
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

export const handleSseEnvelope = createEvent<SseEnvelope>();

export const runSendStreamFx = createEffect(async (prep: LocalPrep): Promise<void> => {
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
		if (env.type === 'llm.stream.done') break;
	}
	// Final sync from server to ensure canonical state.
	await loadEntriesFx({ chatId: prep.chatId, branchId: prep.branchId });
});

// Track active stream state for abort button
$activeStream.on(prepareSendFx.doneData, (_, prep) => ({
	controller: prep.controller,
	chatId: prep.chatId,
	branchId: prep.branchId,
	mode: 'send',
	pendingUserEntryId: prep.pendingUserEntryId,
	pendingAssistantEntryId: prep.pendingAssistantEntryId,
	pendingAssistantMainPartId: prep.pendingAssistantMainPartId,
}));

sample({
	clock: prepareSendFx.doneData,
	target: runSendStreamFx,
});

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

function replaceIdsOnMeta(entries: ChatEntryWithVariantDto[], stream: ActiveStreamState, meta: any): { entries: ChatEntryWithVariantDto[]; stream: ActiveStreamState; generationId: string | null } {
	const userEntryId = typeof meta?.userEntryId === 'string' ? meta.userEntryId : null;
	const assistantEntryId = typeof meta?.assistantEntryId === 'string' ? meta.assistantEntryId : null;
	const assistantVariantId = typeof meta?.assistantVariantId === 'string' ? meta.assistantVariantId : null;
	const assistantMainPartId = typeof meta?.assistantMainPartId === 'string' ? meta.assistantMainPartId : null;
	const generationId = typeof meta?.generationId === 'string' ? meta.generationId : null;

	const nextEntries = entries.map((x) => {
		// Replace optimistic ids
		if (stream.mode === 'send') {
			if (x.entry.entryId === stream.pendingUserEntryId && userEntryId) {
				return { ...x, entry: { ...x.entry, entryId: userEntryId }, variant: x.variant ? { ...x.variant, entryId: userEntryId } : x.variant };
			}
			if (x.entry.entryId === stream.pendingAssistantEntryId && assistantEntryId) {
				const nextVariant = x.variant
					? {
							...x.variant,
							variantId: assistantVariantId ?? x.variant.variantId,
							entryId: assistantEntryId,
							parts: (x.variant.parts ?? []).map((p) =>
								p.partId === stream.pendingAssistantMainPartId && assistantMainPartId ? { ...p, partId: assistantMainPartId } : p,
							),
						}
					: x.variant;
				return {
					...x,
					entry: { ...x.entry, entryId: assistantEntryId, activeVariantId: assistantVariantId ?? x.entry.activeVariantId },
					variant: nextVariant,
				};
			}
		}
		if (stream.mode === 'regenerate' && assistantEntryId && x.entry.entryId === assistantEntryId) {
			const nextVariantId = assistantVariantId ?? x.entry.activeVariantId;
			const nextPartId = assistantMainPartId ?? stream.assistantMainPartId ?? `local_part_${nowIso()}`;
			const currentVariant = x.variant;
			const currentMainPart =
				currentVariant?.parts?.find((p) => p.channel === 'main' && !p.softDeleted) ?? currentVariant?.parts?.[0];

			let nextVariant = currentVariant;
			if (!nextVariant || nextVariant.variantId !== nextVariantId) {
				nextVariant = {
					variantId: nextVariantId,
					entryId: assistantEntryId,
					kind: 'generation',
					createdAt: Date.now(),
					parts: [buildStreamingMainPart(currentMainPart, nextPartId)],
				};
			} else {
				let replaced = false;
				const nextParts = (nextVariant.parts ?? []).map((p) => {
					if (replaced) return p;
					if (p.channel === 'main' && !p.softDeleted) {
						replaced = true;
						return { ...p, partId: nextPartId, payload: '' };
					}
					return p;
				});
				nextVariant = {
					...nextVariant,
					parts: replaced ? nextParts : [buildStreamingMainPart(currentMainPart, nextPartId), ...nextParts],
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
		stream: { ...stream, assistantEntryId: assistantEntryId ?? stream.assistantEntryId, assistantMainPartId: assistantMainPartId ?? stream.assistantMainPartId, generationId: generationId ?? stream.generationId },
		generationId,
	};
}

sample({
	clock: handleSseEnvelope,
	source: { entries: $entries, stream: $activeStream, generationId: $activeGenerationId },
	fn: ({ entries, stream }, env) => {
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

			const nextEntries = entries.map((x) => {
				if (x.entry.entryId !== assistantEntryId) return x;
				if (!x.variant) return x;
				return {
					...x,
					variant: {
						...x.variant,
						parts: (x.variant.parts ?? []).map((p) => (p.partId === partId ? appendDeltaToPart(p, content) : p)),
					},
				};
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
	if (stream) stream.controller.abort();
	if (generationId) void abortGenerationFx({ generationId });
});

$isChatStreaming.on(runSendStreamFx, () => true).on(runSendStreamFx.finally, () => false);

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
	clock: loadVariantsRequested,
	source: $variantsLoadingByEntryId,
	filter: (loadingById, { entryId }) => !loadingById[entryId],
	fn: (_loadingById, payload) => payload,
	target: loadVariantsFx,
});

export const selectVariantRequested = createEvent<{ entryId: string; variantId: string }>();
export const selectVariantFx = createEffect(async (params: { entryId: string; variantId: string }) => selectEntryVariant(params));

sample({ clock: selectVariantRequested, target: selectVariantFx });

sample({
	clock: selectVariantFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadEntriesFx,
});

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

manualEditEntryFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('chat.toasts.variantSaved') });
});

manualEditEntryFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.saveEditError'), description: error instanceof Error ? error.message : String(error) });
});

export const softDeleteEntryRequested = createEvent<{ entryId: string }>();
export const softDeleteEntryFx = createEffect(async (params: { entryId: string }) => softDeleteEntry(params.entryId));

sample({ clock: softDeleteEntryRequested, target: softDeleteEntryFx });

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

export const regenerateRequested = createEvent<{ entryId: string }>();

export const prepareRegenerateFx = createEffect(async (params: { chatId: string; branchId: string; entryId: string }) => {
	const controller = new AbortController();
	return { controller, chatId: params.chatId, branchId: params.branchId, entryId: params.entryId, mode: 'regenerate' as const };
});

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
	for await (const env of streamRegenerateEntry({
		entryId: prep.entryId,
		settings: {},
		signal: prep.controller.signal,
	})) {
		logChatGenerationSseEvent({ scope: 'entry-parts', envelope: env });
		handleSseEnvelope(env);
		if (env.type === 'llm.stream.done') break;
	}
	await loadEntriesFx({ chatId: prep.chatId, branchId: prep.branchId });
	loadVariantsRequested({ entryId: prep.entryId });
});

sample({ clock: prepareRegenerateFx.doneData, target: runRegenerateStreamFx });

$isChatStreaming.on(runRegenerateStreamFx, () => true).on(runRegenerateStreamFx.finally, () => false);

prepareSendFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.sendMessageError'), description: error instanceof Error ? error.message : String(error) });
});

runSendStreamFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.streamError'), description: error instanceof Error ? error.message : String(error) });
});

runRegenerateStreamFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.regenerateError'), description: error instanceof Error ? error.message : String(error) });
});
