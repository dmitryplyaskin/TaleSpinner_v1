import { createEffect, createEvent, createStore, sample } from 'effector';

import type { ChatDto, ChatMessageDto, EntityProfileDto, SseEnvelope } from '../../api/chat-core';
import {
	abortGeneration,
	createChatForEntityProfile,
	createEntityProfile,
	getChatById,
	listChatMessages,
	listChatsForEntityProfile,
	listEntityProfiles,
	streamChatMessage,
} from '../../api/chat-core';

function nowIso(): string {
	return new Date().toISOString();
}

function makeMinimalCharSpecV3(name: string): unknown {
	// v1: backend хранит `spec` как JSON без строгой валидации.
	// Достаточно минимум полей, чтобы `{{char.name}}` работал стабильно.
	return {
		spec_version: '3',
		name,
		first_mes: '',
		description: '',
		personality: '',
		scenario: '',
		mes_example: '',
		creator_notes: '',
		system_prompt: '',
		post_history_instructions: '',
		tags: [],
	};
}

export const loadEntityProfilesFx = createEffect(async (): Promise<EntityProfileDto[]> => listEntityProfiles());

export const $entityProfiles = createStore<EntityProfileDto[]>([]).on(loadEntityProfilesFx.doneData, (_, items) => items);

export const selectEntityProfile = createEvent<EntityProfileDto>();
export const $currentEntityProfile = createStore<EntityProfileDto | null>(null).on(
	selectEntityProfile,
	(_, p) => p,
);

export const createEntityProfileFx = createEffect(async (params: { name: string }): Promise<EntityProfileDto> => {
	return createEntityProfile({ name: params.name, spec: makeMinimalCharSpecV3(params.name) });
});

export const openEntityProfileFx = createEffect(async (profile: EntityProfileDto): Promise<{ chat: ChatDto; branchId: string }> => {
	const chats = await listChatsForEntityProfile(profile.id);
	if (chats[0]?.id) {
		const chat = await getChatById(chats[0].id);
		const branchId = chat.activeBranchId;
		if (!branchId) throw new Error('У чата нет activeBranchId (ожидалось main)');
		return { chat, branchId };
	}

	const created = await createChatForEntityProfile({ entityProfileId: profile.id, title: 'New chat' });
	const chat = created.chat;
	const branchId = chat.activeBranchId ?? created.mainBranch.id;
	return { chat, branchId };
});

export const $currentChat = createStore<ChatDto | null>(null);
export const $currentBranchId = createStore<string | null>(null);

export const setOpenedChat = createEvent<{ chat: ChatDto; branchId: string }>();
$currentChat.on(setOpenedChat, (_, v) => v.chat);
$currentBranchId.on(setOpenedChat, (_, v) => v.branchId);

sample({
	clock: openEntityProfileFx.doneData,
	target: setOpenedChat,
});

export const loadMessagesFx = createEffect(async (params: { chatId: string; branchId: string }): Promise<ChatMessageDto[]> => {
	const res = await listChatMessages({ chatId: params.chatId, branchId: params.branchId, limit: 200 });
	return res.messages;
});

export const $messages = createStore<ChatMessageDto[]>([]).on(loadMessagesFx.doneData, (_, items) => items);

// Reload messages when we open a profile/chat.
sample({
	clock: setOpenedChat,
	fn: ({ chat, branchId }) => ({ chatId: chat.id, branchId }),
	target: loadMessagesFx,
});

export const $isChatStreaming = createStore(false);
export const $activeGenerationId = createStore<string | null>(null);

export const sendMessageRequested = createEvent<{ promptText: string; role?: 'user' | 'system' }>();
export const abortRequested = createEvent();

type ActiveStreamState = {
	controller: AbortController;
	chatId: string;
	branchId: string;
	assistantMessageId: string | null;
	pendingUserTempId: string;
	pendingAssistantTempId: string;
};

const $activeStream = createStore<ActiveStreamState | null>(null);

export const sendMessageFx = createEffect(
	async (params: { chatId: string; branchId: string; role: 'user' | 'system'; promptText: string }) => {
		const controller = new AbortController();
		const pendingUserTempId = `local_user_${nowIso()}`;
		const pendingAssistantTempId = `local_assistant_${nowIso()}`;

		return {
			controller,
			chatId: params.chatId,
			branchId: params.branchId,
			role: params.role,
			promptText: params.promptText,
			pendingUserTempId,
			pendingAssistantTempId,
		};
	},
);

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
	target: sendMessageFx,
});

// Optimistic UI insert (user + assistant placeholder)
sample({
	clock: sendMessageFx.doneData,
	source: $messages,
	fn: (messages, prep) => {
		const ts = nowIso();
		const userMsg: ChatMessageDto = {
			id: prep.pendingUserTempId,
			ownerId: 'global',
			chatId: prep.chatId,
			branchId: prep.branchId,
			role: prep.role,
			createdAt: ts,
			promptText: prep.promptText,
			format: null,
			blocks: [],
			meta: { optimistic: true },
			activeVariantId: null,
		};

		const assistantMsg: ChatMessageDto = {
			id: prep.pendingAssistantTempId,
			ownerId: 'global',
			chatId: prep.chatId,
			branchId: prep.branchId,
			role: 'assistant',
			createdAt: ts,
			promptText: '',
			format: null,
			blocks: [],
			meta: { optimistic: true },
			activeVariantId: null,
		};

		return [...messages, userMsg, assistantMsg];
	},
	target: $messages,
});

// Start SSE loop (separate effect so we can stream and update stores)
export const runStreamFx = createEffect(
	async (prep: Awaited<ReturnType<typeof sendMessageFx>>): Promise<void> => {
		for await (const env of streamChatMessage({
			chatId: prep.chatId,
			branchId: prep.branchId,
			role: prep.role,
			promptText: prep.promptText,
			settings: {},
			signal: prep.controller.signal,
		})) {
			handleSseEnvelope(env);

			if (env.type === 'llm.stream.done') {
				break;
			}
		}

		// Final sync from server to ensure canonical state
		await loadMessagesFx({ chatId: prep.chatId, branchId: prep.branchId });
	},
);

export const handleSseEnvelope = createEvent<SseEnvelope>();

// Track active stream state for abort button
$activeStream.on(sendMessageFx.doneData, (_, prep) => ({
	controller: prep.controller,
	chatId: prep.chatId,
	branchId: prep.branchId,
	assistantMessageId: null,
	pendingUserTempId: prep.pendingUserTempId,
	pendingAssistantTempId: prep.pendingAssistantTempId,
}));

sample({
	clock: sendMessageFx.doneData,
	target: runStreamFx,
});

export const applyStreamPatch = createEvent<{
	msgs: ChatMessageDto[];
	stream: ActiveStreamState | null;
	generationId?: string | null;
}>();

$messages.on(applyStreamPatch, (_, p) => p.msgs);
$activeStream.on(applyStreamPatch, (_, p) => p.stream);
$activeGenerationId.on(applyStreamPatch, (prev, p) => (typeof p.generationId === 'undefined' ? prev : p.generationId));

sample({
	clock: handleSseEnvelope,
	source: { msgs: $messages, stream: $activeStream, generationId: $activeGenerationId },
	fn: ({ msgs, stream }, env) => {
		if (!stream) return { msgs, stream, generationId: null };

		if (env.type === 'llm.stream.meta') {
			const meta = env.data as any;
			const userId = meta?.userMessageId as string | undefined;
			const assistantId = meta?.assistantMessageId as string | undefined;
			const generationId = meta?.generationId as string | undefined;

			return {
				msgs: msgs.map((m) => {
					if (m.id === stream.pendingUserTempId && userId) return { ...m, id: userId, meta: null };
					if (m.id === stream.pendingAssistantTempId && assistantId) return { ...m, id: assistantId, meta: null };
					return m;
				}),
				stream: { ...stream, assistantMessageId: assistantId ?? stream.assistantMessageId },
				generationId: generationId ?? null,
			};
		}

		if (env.type === 'llm.stream.delta') {
			const delta = env.data as any;
			const content = typeof delta?.content === 'string' ? delta.content : '';
			if (!content) return { msgs, stream };
			const assistantId = stream.assistantMessageId ?? stream.pendingAssistantTempId;
			return {
				msgs: msgs.map((m) => (m.id === assistantId ? { ...m, promptText: (m.promptText ?? '') + content } : m)),
				stream,
			};
		}

		if (env.type === 'llm.stream.done') {
			return { msgs, stream: null, generationId: null };
		}

		return { msgs, stream };
	},
	target: applyStreamPatch,
});

export const abortGenerationFx = createEffect(async (params: { generationId: string }) => abortGeneration(params.generationId));

export const doAbort = createEvent<{ stream: ActiveStreamState; generationId: string | null }>();

sample({
	clock: abortRequested,
	source: { stream: $activeStream, generationId: $activeGenerationId },
	filter: ({ stream }) => Boolean(stream),
	fn: ({ stream, generationId }) => ({ stream: stream!, generationId }),
	target: doAbort,
});

doAbort.watch(({ stream, generationId }) => {
	stream.controller.abort();
	if (generationId) void abortGenerationFx({ generationId });
});

// Streaming state for the UI (button toggles / input disabled)
$isChatStreaming.on(runStreamFx, () => true).on(runStreamFx.finally, () => false);

// Auto refresh profiles list after creating one
sample({
	clock: createEntityProfileFx.doneData,
	target: loadEntityProfilesFx,
});

sample({
	clock: createEntityProfileFx.doneData,
	target: selectEntityProfile,
});

// Auto-open first profile on app start (if nothing selected yet)
sample({
	clock: loadEntityProfilesFx.doneData,
	source: $currentEntityProfile,
	filter: (current, profiles) => !current && profiles.length > 0,
	fn: (_, profiles) => profiles[0],
	target: selectEntityProfile,
});

// Selecting a profile opens its latest chat
sample({
	clock: selectEntityProfile,
	target: openEntityProfileFx,
});

