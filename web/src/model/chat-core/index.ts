import { createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';

import {
	activateChatBranch,
	createChatBranch,
	createChatForEntityProfile,
	createEntityProfile,
	deleteChat,
	deleteEntityProfile,
	getChatById,
	importEntityProfiles,
	listChatBranches,
	listChatsForEntityProfile,
	listEntityProfiles,
	setChatPromptTemplate,
	updateEntityProfile,
} from '../../api/chat-core';
import { listChatEntries } from '../../api/chat-entry-parts';
import i18n from '../../i18n';

import type {
	ChatBranchDto,
	ChatDto,
	CreateChatResponse,
	EntityProfileDto,
	ImportEntityProfilesResponse,
} from '../../api/chat-core';

function makeMinimalCharSpecV3(name: string): unknown {
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

export const updateEntityProfileRequested = createEvent<{
	id: string;
	name?: string;
	kind?: 'CharSpec';
	spec?: unknown;
	meta?: unknown;
	isFavorite?: boolean;
	avatarAssetId?: string | null;
}>();

export const updateEntityProfileFx = createEffect(
	async (params: {
		id: string;
		name?: string;
		kind?: 'CharSpec';
		spec?: unknown;
		meta?: unknown;
		isFavorite?: boolean;
		avatarAssetId?: string | null;
	}): Promise<EntityProfileDto> => {
		return updateEntityProfile(params);
	},
);

export const $updateEntityProfilePendingId = createStore<string | null>(null)
	.on(updateEntityProfileFx, (_, params) => params.id)
	.on(updateEntityProfileFx.finally, (state, { params }) => (state === params.id ? null : state));

sample({
	clock: updateEntityProfileRequested,
	target: updateEntityProfileFx,
});

$entityProfiles.on(updateEntityProfileFx.doneData, (items, updated) => items.map((item) => (item.id === updated.id ? updated : item)));
$currentEntityProfile.on(updateEntityProfileFx.doneData, (current, updated) => (current?.id === updated.id ? updated : current));

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
			if (branchId) {
				const res = await listChatEntries({ chatId: chat.id, branchId, limit: 1 });
				if (res.entries.length > 0) return { chats, chat, branchId };
			}
		}

		const created = await createChatForEntityProfile({ entityProfileId: profile.id, title: i18n.t('chat.defaults.newChat') });
		const chat = created.chat;
		const branchId = chat.activeBranchId ?? created.mainBranch.id;
		return { chats: [...chats, chat], chat, branchId };
	},
);

openEntityProfileFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.openChatError'), description: error instanceof Error ? error.message : String(error) });
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

export const setChatPromptTemplateRequested = createEvent<{ promptTemplateId: string | null }>();

export const setChatPromptTemplateFx = createEffect(
	async (params: { chatId: string; promptTemplateId: string | null }): Promise<ChatDto> => {
		return setChatPromptTemplate({ chatId: params.chatId, promptTemplateId: params.promptTemplateId });
	},
);

sample({
	clock: setChatPromptTemplateRequested,
	source: $currentChat,
	filter: (chat): chat is ChatDto => Boolean(chat?.id),
	fn: (chat, payload) => ({ chatId: chat!.id, promptTemplateId: payload.promptTemplateId }),
	target: setChatPromptTemplateFx,
});

$currentChat.on(setChatPromptTemplateFx.doneData, (_, chat) => chat);
$chatsForCurrentProfile.on(setChatPromptTemplateFx.doneData, (items, updated) =>
	items.map((c) => (c.id === updated.id ? updated : c)),
);

setChatPromptTemplateFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('chat.toasts.selectTemplateError'),
		description: error instanceof Error ? error.message : String(error),
	});
});

export const openChatRequested = createEvent<{ chatId: string }>();

export const openChatFx = createEffect(async (params: { chatId: string }): Promise<{ chat: ChatDto; branchId: string }> => {
	const chat = await getChatById(params.chatId);
	const branchId = chat.activeBranchId;
	if (!branchId) throw new Error(i18n.t('chat.errors.branchIdRequired'));
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
		return createChatForEntityProfile({ entityProfileId: params.entityProfileId, title: params.title ?? i18n.t('chat.defaults.newChat') });
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
	toaster.error({ title: i18n.t('chat.toasts.deleteChatError'), description: error instanceof Error ? error.message : String(error) });
});

export const loadBranchesFx = createEffect(async (params: { chatId: string }): Promise<ChatBranchDto[]> => {
	return listChatBranches(params.chatId);
});

export const $branches = createStore<ChatBranchDto[]>([]).on(loadBranchesFx.doneData, (_, items) => items);

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
	toaster.error({ title: i18n.t('chat.toasts.activateBranchError'), description: error instanceof Error ? error.message : String(error) });
});

export const createBranchRequested = createEvent<{ title?: string }>();

export const createBranchFx = createEffect(
	async (params: {
		chatId: string;
		parentBranchId?: string;
		title?: string;
	}): Promise<ChatBranchDto> => {
		return createChatBranch({
			chatId: params.chatId,
			title: params.title,
			parentBranchId: params.parentBranchId,
		});
	},
);

sample({
	clock: createBranchRequested,
	source: { chat: $currentChat, branchId: $currentBranchId },
	filter: ({ chat, branchId }) => Boolean(chat?.id && branchId),
	fn: ({ chat, branchId }, payload) => {
		const title = payload.title ?? `branch ${new Date().toLocaleTimeString()}`;
		return {
			chatId: chat!.id,
			parentBranchId: branchId ?? undefined,
			title,
		};
	},
	target: createBranchFx,
});

sample({
	clock: createBranchFx.doneData,
	source: $currentChat,
	filter: (chat): chat is ChatDto => Boolean(chat?.id),
	fn: (chat, branch) => ({ chatId: chat!.id, branchId: branch.id }),
	target: activateBranchFx,
});

createBranchFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.createBranchError'), description: error instanceof Error ? error.message : String(error) });
});

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
		toaster.error({ title: i18n.t('chat.toasts.importItemError', { name: originalName }), description: error });
	});
	if (res.created.length > 0) {
		toaster.success({ title: i18n.t('chat.toasts.importCompleted'), description: res.message });
	} else {
		toaster.error({ title: i18n.t('chat.toasts.importFailed'), description: res.message });
	}
});

importEntityProfilesFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('chat.toasts.importFailed'), description: error instanceof Error ? error.message : String(error) });
});

sample({
	clock: importEntityProfilesFx.doneData,
	target: loadEntityProfilesFx,
});

sample({
	clock: loadEntityProfilesFx.doneData,
	source: $currentEntityProfile,
	filter: (current, profiles) => !current && profiles.length > 0,
	fn: (_, profiles) => profiles[0],
	target: selectEntityProfile,
});

sample({
	clock: selectEntityProfile,
	target: openEntityProfileFx,
});

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
	toaster.success({ title: i18n.t('chat.toasts.profileDeleted') });
});

deleteEntityProfileFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('chat.toasts.deleteProfileError'),
		description: error instanceof Error ? error.message : String(error),
	});
});

updateEntityProfileFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('chat.toasts.updateProfileError'),
		description: error instanceof Error ? error.message : String(error),
	});
});
