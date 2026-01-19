import { createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';

import type {
	ChatDto,
	ChatBranchDto,
	ChatMessageDto,
	CreateChatResponse,
	EntityProfileDto,
	ImportEntityProfilesResponse,
	MessageVariantDto,
	SseEnvelope,
} from '../../api/chat-core';
import {
	abortGeneration,
	activateChatBranch,
	createChatBranch,
	createChatForEntityProfile,
	createManualEditVariant,
	createEntityProfile,
	deleteChat,
	deleteChatMessage,
	deleteEntityProfile,
	getChatById,
	importEntityProfiles,
	listChatMessages,
	listChatBranches,
	listChatsForEntityProfile,
	listEntityProfiles,
	listMessageVariants,
	selectMessageVariant,
	streamChatMessage,
	streamRegenerateMessageVariant,
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

export const $entityProfiles = createStore<EntityProfileDto[]>([]).on(
	loadEntityProfilesFx.doneData,
	(_, items) => items,
);

export const selectEntityProfile = createEvent<EntityProfileDto>();
export const $currentEntityProfile = createStore<EntityProfileDto | null>(null).on(selectEntityProfile, (_, p) => p);

export const clearCurrentEntityProfile = createEvent();
$currentEntityProfile.on(clearCurrentEntityProfile, () => null);

export const createEntityProfileFx = createEffect(async (params: { name: string }): Promise<EntityProfileDto> => {
	return createEntityProfile({ name: params.name, spec: makeMinimalCharSpecV3(params.name) });
});

export const importEntityProfilesFx = createEffect(async (files: File[]): Promise<ImportEntityProfilesResponse> => {
	return importEntityProfiles(files);
});

export const openEntityProfileFx = createEffect(
	async (
		profile: EntityProfileDto,
	): Promise<{ chats: ChatDto[]; chat: ChatDto; branchId: string }> => {
		const chats = await listChatsForEntityProfile(profile.id);
		if (chats[0]?.id) {
			const chat = await getChatById(chats[0].id);
			const branchId = chat.activeBranchId;
			// Если по какой-то причине activeBranchId отсутствует (битые/старые данные) — создаём новый чат.
			if (branchId) {
				// Если чат пустой (например, создано ранее без интро) — создаём новый чат.
				const res = await listChatMessages({ chatId: chat.id, branchId, limit: 1 });
				if (res.messages.length > 0) return { chats, chat, branchId };
			}
		}

		const created = await createChatForEntityProfile({ entityProfileId: profile.id, title: 'New chat' });
		const chat = created.chat;
		const branchId = chat.activeBranchId ?? created.mainBranch.id;
		return { chats: [...chats, chat], chat, branchId };
	},
);

openEntityProfileFx.failData.watch((error) => {
	toaster.error({ title: 'Не удалось открыть чат', description: error instanceof Error ? error.message : String(error) });
});

export const $currentChat = createStore<ChatDto | null>(null);
export const $currentBranchId = createStore<string | null>(null);

export const $chatsForCurrentProfile = createStore<ChatDto[]>([]).on(
	openEntityProfileFx.doneData,
	(_, payload) => payload.chats,
);

export const setOpenedChat = createEvent<{ chat: ChatDto; branchId: string }>();
$currentChat.on(setOpenedChat, (_, v) => v.chat);
$currentBranchId.on(setOpenedChat, (_, v) => v.branchId);

sample({
	clock: openEntityProfileFx.doneData,
	fn: ({ chat, branchId }) => ({ chat, branchId }),
	target: setOpenedChat,
});

// ---- Multi-chat UX (v1): list/create/open/delete chats within current EntityProfile

export const openChatRequested = createEvent<{ chatId: string }>();

export const openChatFx = createEffect(async (params: { chatId: string }): Promise<{ chat: ChatDto; branchId: string }> => {
	const chat = await getChatById(params.chatId);
	const branchId = chat.activeBranchId;
	if (!branchId) throw new Error('branchId обязателен (нет activeBranchId)');
	return { chat, branchId };
});

sample({
	clock: openChatRequested,
	target: openChatFx,
});

sample({
	clock: openChatFx.doneData,
	target: setOpenedChat,
});

export const createChatRequested = createEvent<{ title?: string }>();

export const createChatFx = createEffect(
	async (params: { entityProfileId: string; title?: string }): Promise<CreateChatResponse> => {
		return createChatForEntityProfile({ entityProfileId: params.entityProfileId, title: params.title ?? 'New chat' });
	},
);

sample({
	clock: createChatRequested,
	source: $currentEntityProfile,
	filter: (profile): profile is EntityProfileDto => Boolean(profile?.id),
	fn: (profile, payload) => ({ entityProfileId: profile!.id, title: payload.title }),
	target: createChatFx,
});

sample({
	clock: createChatFx.doneData,
	fn: ({ chat, mainBranch }) => ({ chat, branchId: chat.activeBranchId ?? mainBranch.id }),
	target: setOpenedChat,
});

// Refresh chats list after create/delete.
sample({
	clock: createChatFx.doneData,
	source: $currentEntityProfile,
	filter: (profile): profile is EntityProfileDto => Boolean(profile?.id),
	target: openEntityProfileFx,
});

export const deleteChatRequested = createEvent<{ chatId: string }>();

export const deleteChatFx = createEffect(async (params: { chatId: string }): Promise<ChatDto> => {
	return deleteChat(params.chatId);
});

sample({
	clock: deleteChatRequested,
	target: deleteChatFx,
});

sample({
	clock: deleteChatFx.doneData,
	source: $currentEntityProfile,
	filter: (profile): profile is EntityProfileDto => Boolean(profile?.id),
	target: openEntityProfileFx,
});

deleteChatFx.failData.watch((error) => {
	toaster.error({ title: 'Не удалось удалить чат', description: error instanceof Error ? error.message : String(error) });
});

export const loadMessagesFx = createEffect(
	async (params: { chatId: string; branchId: string }): Promise<ChatMessageDto[]> => {
		const res = await listChatMessages({ chatId: params.chatId, branchId: params.branchId, limit: 200 });
		return res.messages;
	},
);

export const $messages = createStore<ChatMessageDto[]>([]).on(loadMessagesFx.doneData, (_, items) => items);

// ---- Branches (v1)

export const loadBranchesFx = createEffect(async (params: { chatId: string }): Promise<ChatBranchDto[]> => {
	return listChatBranches(params.chatId);
});

export const $branches = createStore<ChatBranchDto[]>([]).on(loadBranchesFx.doneData, (_, items) => items);

// Reload branches when we open a chat.
sample({
	clock: setOpenedChat,
	fn: ({ chat }) => ({ chatId: chat.id }),
	target: loadBranchesFx,
});

export const activateBranchRequested = createEvent<{ branchId: string }>();

export const activateBranchFx = createEffect(async (params: { chatId: string; branchId: string }): Promise<ChatDto> => {
	return activateChatBranch({ chatId: params.chatId, branchId: params.branchId });
});

sample({
	clock: activateBranchRequested,
	source: $currentChat,
	filter: (chat): chat is ChatDto => Boolean(chat?.id),
	fn: (chat, payload) => ({ chatId: chat!.id, branchId: payload.branchId }),
	target: activateBranchFx,
});

sample({
	clock: activateBranchFx.doneData,
	fn: (chat) => ({ chat, branchId: chat.activeBranchId ?? '' }),
	target: setOpenedChat,
});

activateBranchFx.failData.watch((error) => {
	toaster.error({ title: 'Не удалось активировать ветку', description: error instanceof Error ? error.message : String(error) });
});

export const createBranchRequested = createEvent<{ title?: string }>();

export const createBranchFx = createEffect(
	async (params: {
		chatId: string;
		parentBranchId?: string;
		forkedFromMessageId?: string;
		forkedFromVariantId?: string;
		title?: string;
	}): Promise<ChatBranchDto> => {
		return createChatBranch({
			chatId: params.chatId,
			title: params.title,
			parentBranchId: params.parentBranchId,
			forkedFromMessageId: params.forkedFromMessageId,
			forkedFromVariantId: params.forkedFromVariantId,
		});
	},
);

sample({
	clock: createBranchRequested,
	source: { chat: $currentChat, branchId: $currentBranchId, msgs: $messages },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId, msgs }, payload) => {
		const last = [...msgs].reverse().find((m) => !String(m.id).startsWith('local_')) ?? null;
		const title = payload.title ?? `branch ${new Date().toLocaleTimeString()}`;
		return {
			chatId: chat!.id,
			parentBranchId: branchId ?? undefined,
			forkedFromMessageId: last?.id,
			forkedFromVariantId: last?.activeVariantId ?? undefined,
			title,
		};
	},
	target: createBranchFx,
});

// After creating a branch, activate it.
sample({
	clock: createBranchFx.doneData,
	source: $currentChat,
	filter: (chat): chat is ChatDto => Boolean(chat?.id),
	fn: (chat, branch) => ({ chatId: chat!.id, branchId: branch.id }),
	target: activateBranchFx,
});

createBranchFx.failData.watch((error) => {
	toaster.error({ title: 'Не удалось создать ветку', description: error instanceof Error ? error.message : String(error) });
});

export const loadVariantsFx = createEffect(async (params: { messageId: string }) => {
	const variants = await listMessageVariants(params.messageId);
	return { messageId: params.messageId, variants };
});

export const $variantsByMessageId = createStore<Record<string, MessageVariantDto[]>>({}).on(
	loadVariantsFx.doneData,
	(prev, { messageId, variants }) => ({ ...prev, [messageId]: variants }),
);

const loadVariantsForLastAssistantMaybe = createEvent<{ messageId: string } | null>();
const loadVariantsForLastAssistant = createEvent<{ messageId: string }>();

// Auto-load variants for the last assistant message in the opened chat.
sample({
	clock: loadMessagesFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }, messages) => Boolean(chat?.id && branchId && messages.length > 0),
	fn: (_, messages) => {
		const id = [...messages].reverse().find((m) => m.role === 'assistant')?.id;
		return id ? { messageId: id } : null;
	},
	target: loadVariantsForLastAssistantMaybe,
});

sample({
	clock: loadVariantsForLastAssistantMaybe,
	filter: (payload): payload is { messageId: string } => Boolean(payload?.messageId),
	target: loadVariantsForLastAssistant,
});

sample({
	clock: loadVariantsForLastAssistant,
	target: loadVariantsFx,
});

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
	pendingUserTempId?: string;
	pendingAssistantTempId?: string;
	mode: 'send' | 'regenerate';
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
			mode: 'send' as const,
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
export const runStreamFx = createEffect(async (prep: Awaited<ReturnType<typeof sendMessageFx>>): Promise<void> => {
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
});

export const handleSseEnvelope = createEvent<SseEnvelope>();

// Track active stream state for abort button
$activeStream.on(sendMessageFx.doneData, (_, prep) => ({
	controller: prep.controller,
	chatId: prep.chatId,
	branchId: prep.branchId,
	assistantMessageId: null,
	pendingUserTempId: prep.pendingUserTempId,
	pendingAssistantTempId: prep.pendingAssistantTempId,
	mode: prep.mode,
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
			const userId = typeof meta?.userMessageId === 'string' ? (meta.userMessageId as string) : undefined;
			const assistantId = meta?.assistantMessageId as string | undefined;
			const generationId = meta?.generationId as string | undefined;
			const variantId = meta?.variantId as string | undefined;

			return {
				msgs: msgs.map((m) => {
					if (stream.mode === 'send') {
						if (m.id === stream.pendingUserTempId && userId) return { ...m, id: userId, meta: null };
						if (m.id === stream.pendingAssistantTempId && assistantId) return { ...m, id: assistantId, meta: null };
					}
					if (stream.mode === 'regenerate' && assistantId && m.id === assistantId) {
						return {
							...m,
							activeVariantId: variantId ?? m.activeVariantId,
							promptText: '',
						};
					}
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
			const assistantId = stream.assistantMessageId ?? stream.pendingAssistantTempId ?? null;
			if (!assistantId) return { msgs, stream };
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

export const abortGenerationFx = createEffect(async (params: { generationId: string }) =>
	abortGeneration(params.generationId),
);

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

// ---- Variants: select / regenerate (last assistant message)

export const selectVariantRequested = createEvent<{ messageId: string; variantId: string }>();
export const regenerateVariantRequested = createEvent<{ messageId: string }>();

export const selectVariantFx = createEffect(
	async (params: { messageId: string; variantId: string }): Promise<MessageVariantDto> => {
		return selectMessageVariant({ messageId: params.messageId, variantId: params.variantId });
	},
);

const applyVariantsPatch = createEvent<{
	msgs: ChatMessageDto[];
	variantsById: Record<string, MessageVariantDto[]>;
}>();
$messages.on(applyVariantsPatch, (_, p) => p.msgs);
$variantsByMessageId.on(applyVariantsPatch, (_, p) => p.variantsById);

sample({
	clock: selectVariantFx.doneData,
	source: { msgs: $messages, variantsById: $variantsByMessageId },
	fn: ({ msgs, variantsById }, selected) => {
		const existing = variantsById[selected.messageId] ?? [];
		const nextVariants = existing.map((v) => ({ ...v, isSelected: v.id === selected.id }));
		return {
			msgs: msgs.map((m) =>
				m.id === selected.messageId ? { ...m, activeVariantId: selected.id, promptText: selected.promptText ?? '' } : m,
			),
			variantsById: { ...variantsById, [selected.messageId]: nextVariants },
		};
	},
	target: applyVariantsPatch,
});

sample({
	clock: selectVariantRequested,
	target: selectVariantFx,
});

export const prepareRegenerateFx = createEffect(
	async (params: { chatId: string; branchId: string; messageId: string }) => {
		const controller = new AbortController();
		return {
			controller,
			chatId: params.chatId,
			branchId: params.branchId,
			assistantMessageId: params.messageId,
			mode: 'regenerate' as const,
		};
	},
);

sample({
	clock: regenerateVariantRequested,
	source: { chat: $currentChat, branchId: $currentBranchId, isStreaming: $isChatStreaming },
	filter: ({ chat, branchId, isStreaming }) => Boolean(chat?.id && branchId && !isStreaming),
	fn: ({ chat, branchId }, { messageId }) => ({ chatId: chat!.id, branchId: branchId!, messageId }),
	target: prepareRegenerateFx,
});

// Optimistic clear assistant message content before regenerate streaming.
sample({
	clock: prepareRegenerateFx.doneData,
	source: $messages,
	fn: (msgs, prep) =>
		msgs.map((m) => (m.id === prep.assistantMessageId ? { ...m, promptText: '', meta: { optimistic: true } } : m)),
	target: $messages,
});

$activeStream.on(prepareRegenerateFx.doneData, (_, prep) => ({
	controller: prep.controller,
	chatId: prep.chatId,
	branchId: prep.branchId,
	assistantMessageId: prep.assistantMessageId,
	mode: prep.mode,
}));

export const runRegenerateStreamFx = createEffect(
	async (prep: Awaited<ReturnType<typeof prepareRegenerateFx>>): Promise<void> => {
		for await (const env of streamRegenerateMessageVariant({
			messageId: prep.assistantMessageId!,
			settings: {},
			signal: prep.controller.signal,
		})) {
			handleSseEnvelope(env);
			if (env.type === 'llm.stream.done') break;
		}

		await loadMessagesFx({ chatId: prep.chatId, branchId: prep.branchId });
		await loadVariantsFx({ messageId: prep.assistantMessageId! });
	},
);

sample({
	clock: prepareRegenerateFx.doneData,
	target: runRegenerateStreamFx,
});

$isChatStreaming.on(runRegenerateStreamFx, () => true).on(runRegenerateStreamFx.finally, () => false);

// ---- Edit/Delete messages (v1)

export const deleteMessageRequested = createEvent<{ messageId: string }>();

export const deleteMessageFx = createEffect(async (params: { messageId: string }): Promise<{ id: string }> => {
	return deleteChatMessage(params.messageId);
});

sample({
	clock: deleteMessageRequested,
	target: deleteMessageFx,
});

sample({
	clock: deleteMessageFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadMessagesFx,
});

deleteMessageFx.doneData.watch(() => {
	toaster.success({ title: 'Сообщение удалено' });
});

deleteMessageFx.failData.watch((error) => {
	toaster.error({ title: 'Не удалось удалить сообщение', description: error instanceof Error ? error.message : String(error) });
});

export const manualEditMessageRequested = createEvent<{ messageId: string; promptText: string }>();

export const manualEditMessageFx = createEffect(
	async (params: { messageId: string; promptText: string }): Promise<MessageVariantDto> => {
		return createManualEditVariant({ messageId: params.messageId, promptText: params.promptText });
	},
);

sample({
	clock: manualEditMessageRequested,
	target: manualEditMessageFx,
});

sample({
	clock: manualEditMessageFx.doneData,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }) => ({ chatId: chat!.id, branchId: branchId! }),
	target: loadMessagesFx,
});

sample({
	clock: manualEditMessageFx.doneData,
	fn: (variant) => ({ messageId: variant.messageId }),
	target: loadVariantsFx,
});

manualEditMessageFx.doneData.watch(() => {
	toaster.success({ title: 'Вариант сохранён' });
});

manualEditMessageFx.failData.watch((error) => {
	toaster.error({ title: 'Не удалось сохранить правку', description: error instanceof Error ? error.message : String(error) });
});

// Auto refresh profiles list after creating one
sample({
	clock: createEntityProfileFx.doneData,
	target: loadEntityProfilesFx,
});

sample({
	clock: createEntityProfileFx.doneData,
	target: selectEntityProfile,
});

importEntityProfilesFx.doneData.watch((res) => {
	res.failed.forEach(({ originalName, error }) => {
		toaster.error({ title: `Ошибка импорта ${originalName}`, description: error });
	});
	if (res.created.length > 0) {
		toaster.success({ title: 'Импорт завершён', description: res.message });
	} else {
		toaster.error({ title: 'Импорт не удался', description: res.message });
	}
});

importEntityProfilesFx.failData.watch((error) => {
	toaster.error({ title: 'Импорт не удался', description: error instanceof Error ? error.message : String(error) });
});

sample({
	clock: importEntityProfilesFx.doneData,
	target: loadEntityProfilesFx,
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

// --- Delete profile (best-effort: clear selection first if it points to the deleted one)

export const deleteEntityProfileRequested = createEvent<{ id: string }>();

export const deleteEntityProfileFx = createEffect(async (params: { id: string }): Promise<{ id: string }> => {
	return deleteEntityProfile(params.id);
});

sample({
	clock: deleteEntityProfileRequested,
	target: deleteEntityProfileFx,
});

sample({
	clock: deleteEntityProfileFx.doneData,
	source: $currentEntityProfile,
	filter: (current, payload) => Boolean(current?.id && current.id === payload.id),
	target: clearCurrentEntityProfile,
});

sample({
	clock: deleteEntityProfileFx.doneData,
	target: loadEntityProfilesFx,
});

deleteEntityProfileFx.doneData.watch(() => {
	toaster.success({ title: 'Профиль удалён' });
});

deleteEntityProfileFx.failData.watch((error) => {
	toaster.error({
		title: 'Не удалось удалить профиль',
		description: error instanceof Error ? error.message : String(error),
	});
});
