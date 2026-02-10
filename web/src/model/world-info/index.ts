import { combine, createEffect, createEvent, createStore, sample } from 'effector';

import {
	createWorldInfoBook,
	deleteWorldInfoBook,
	duplicateWorldInfoBook,
	getWorldInfoBook,
	getWorldInfoSettings,
	importWorldInfoBook,
	listWorldInfoBindings,
	listWorldInfoBooks,
	replaceWorldInfoBindings,
	updateWorldInfoBook,
	updateWorldInfoSettings,
	type WorldInfoBindingDto,
	type WorldInfoBookData,
	type WorldInfoBookDto,
	type WorldInfoBookSummaryDto,
	type WorldInfoSettingsDto,
} from '../../api/world-info';
import i18n from '../../i18n';
import { toaster } from '../../ui/toaster';
import { $currentChat, setOpenedChat } from '../chat-core';

import type { ChatDto } from '../../api/chat-core';

const DEFAULT_OWNER_ID = 'global';

const DEFAULT_BOOK_DATA: WorldInfoBookData = {
	entries: {},
	extensions: {},
};

export const worldInfoRefreshRequested = createEvent();
export const worldInfoBookSelected = createEvent<string | null>();
export const worldInfoBookCreateRequested = createEvent();
export const worldInfoBookDuplicateRequested = createEvent<{ id: string }>();
export const worldInfoBookDeleteRequested = createEvent<{ id: string }>();
export const worldInfoBookSaveRequested = createEvent<{
	id: string;
	name: string;
	slug: string;
	description: string | null;
	data: unknown;
	version: number;
}>();
export const worldInfoSettingsSaveRequested = createEvent<{
	patch: Partial<Omit<WorldInfoSettingsDto, 'ownerId' | 'createdAt' | 'updatedAt'>>;
}>();
export const worldInfoBookBindingToggleRequested = createEvent<{ bookId: string; enabled: boolean }>();
export const worldInfoImportBookRequested = createEvent<{ file: File }>();
export const worldInfoEditorOpenRequested = createEvent<{ bookId: string | null }>();
export const setWorldInfoBookBoundToEntityRequested = createEvent<{
	entityProfileId: string;
	bookId: string | null;
	silent?: boolean;
}>();

export const loadWorldInfoBooksFx = createEffect(async (): Promise<WorldInfoBookSummaryDto[]> => {
	const response = await listWorldInfoBooks({ ownerId: DEFAULT_OWNER_ID, limit: 200 });
	return response.items;
});

export const loadWorldInfoBookFx = createEffect(async (id: string): Promise<WorldInfoBookDto> => {
	return getWorldInfoBook(id);
});

export const loadWorldInfoSettingsFx = createEffect(async (): Promise<WorldInfoSettingsDto> => {
	return getWorldInfoSettings(DEFAULT_OWNER_ID);
});

export const loadWorldInfoChatBindingsFx = createEffect(async (params: { chatId: string }): Promise<WorldInfoBindingDto[]> => {
	return listWorldInfoBindings({
		ownerId: DEFAULT_OWNER_ID,
		scope: 'chat',
		scopeId: params.chatId,
	});
});

export const loadWorldInfoEntityBindingsFx = createEffect(async (): Promise<WorldInfoBindingDto[]> => {
	return listWorldInfoBindings({
		ownerId: DEFAULT_OWNER_ID,
		scope: 'entity_profile',
	});
});

export const createWorldInfoBookFx = createEffect(async (): Promise<WorldInfoBookDto> => {
	return createWorldInfoBook({
		ownerId: DEFAULT_OWNER_ID,
		name: i18n.t('worldInfo.defaults.newBook'),
		data: DEFAULT_BOOK_DATA,
	});
});

export const duplicateWorldInfoBookFx = createEffect(async (params: { id: string }): Promise<WorldInfoBookDto> => {
	return duplicateWorldInfoBook({ id: params.id, ownerId: DEFAULT_OWNER_ID });
});

export const deleteWorldInfoBookFx = createEffect(async (params: { id: string }): Promise<{ id: string }> => {
	return deleteWorldInfoBook(params.id);
});

export const saveWorldInfoBookFx = createEffect(
	async (params: { id: string; name: string; slug: string; description: string | null; data: unknown; version: number }) => {
		return updateWorldInfoBook({
			id: params.id,
			ownerId: DEFAULT_OWNER_ID,
			name: params.name,
			slug: params.slug,
			description: params.description,
			data: params.data,
			version: params.version,
		});
	},
);

export const saveWorldInfoSettingsFx = createEffect(
	async (params: { patch: Partial<Omit<WorldInfoSettingsDto, 'ownerId' | 'createdAt' | 'updatedAt'>> }) => {
		return updateWorldInfoSettings({ ownerId: DEFAULT_OWNER_ID, patch: params.patch });
	},
);

export const setWorldInfoBookBoundToCurrentChatFx = createEffect(
	async (params: { chatId: string; bookId: string; enabled: boolean }): Promise<WorldInfoBindingDto[]> => {
		const existing = await listWorldInfoBindings({
			ownerId: DEFAULT_OWNER_ID,
			scope: 'chat',
			scopeId: params.chatId,
		});

		const byBookId = new Map(existing.map((item) => [item.bookId, item]));
		const ordered = existing
			.slice()
			.sort((a, b) => a.displayOrder - b.displayOrder)
			.map((item) => ({
				bookId: item.bookId,
				bindingRole: item.bindingRole,
				displayOrder: item.displayOrder,
				enabled: item.enabled,
			}));

		if (byBookId.has(params.bookId)) {
			const next = ordered.map((item) =>
				item.bookId === params.bookId
					? {
						...item,
						enabled: params.enabled,
					}
					: item,
			);
			const normalized = next.map((item, idx) => ({ ...item, displayOrder: idx }));
			return replaceWorldInfoBindings({
				ownerId: DEFAULT_OWNER_ID,
				scope: 'chat',
				scopeId: params.chatId,
				items: normalized,
			});
		}

		if (!params.enabled) {
			return existing;
		}

		const normalized = [
			...ordered,
			{
				bookId: params.bookId,
				bindingRole: 'additional' as const,
				displayOrder: ordered.length,
				enabled: true,
			},
		].map((item, idx) => ({ ...item, displayOrder: idx }));

		return replaceWorldInfoBindings({
			ownerId: DEFAULT_OWNER_ID,
			scope: 'chat',
			scopeId: params.chatId,
			items: normalized,
		});
	},
);

export const importWorldInfoBookFx = createEffect(async (params: { file: File }) => {
	return importWorldInfoBook({ file: params.file, ownerId: DEFAULT_OWNER_ID, format: 'auto' });
});

export const setWorldInfoBookBoundToEntityFx = createEffect(
	async (params: {
		entityProfileId: string;
		bookId: string | null;
		silent?: boolean;
	}): Promise<WorldInfoBindingDto[]> => {
		const items =
			typeof params.bookId === 'string' && params.bookId.trim().length > 0
				? [
					{
						bookId: params.bookId,
						bindingRole: 'primary' as const,
						displayOrder: 0,
						enabled: true,
					},
				]
				: [];
		return replaceWorldInfoBindings({
			ownerId: DEFAULT_OWNER_ID,
			scope: 'entity_profile',
			scopeId: params.entityProfileId,
			items,
		});
	},
);

export const $worldInfoBooks = createStore<WorldInfoBookSummaryDto[]>([]).on(loadWorldInfoBooksFx.doneData, (_, items) => items);

export const $selectedWorldInfoBookId = createStore<string | null>(null).on(worldInfoBookSelected, (_, id) => id);
export const $worldInfoEditorLaunch = createStore<{ nonce: number; bookId: string | null }>({ nonce: 0, bookId: null }).on(
	worldInfoEditorOpenRequested,
	(state, payload) => ({
		nonce: state.nonce + 1,
		bookId: payload.bookId,
	}),
);

export const clearSelectedWorldInfoBook = createEvent();

export const $selectedWorldInfoBook = createStore<WorldInfoBookDto | null>(null)
	.on(loadWorldInfoBookFx.doneData, (_, item) => item)
	.on(saveWorldInfoBookFx.doneData, (_, item) => item)
	.on(clearSelectedWorldInfoBook, () => null);

export const $worldInfoSettings = createStore<WorldInfoSettingsDto | null>(null)
	.on(loadWorldInfoSettingsFx.doneData, (_, settings) => settings)
	.on(saveWorldInfoSettingsFx.doneData, (_, settings) => settings);

export const $worldInfoChatBindings = createStore<WorldInfoBindingDto[]>([])
	.on(loadWorldInfoChatBindingsFx.doneData, (_, items) => items)
	.on(setWorldInfoBookBoundToCurrentChatFx.doneData, (_, items) => items);

export const $worldInfoEntityBindings = createStore<WorldInfoBindingDto[]>(
	[],
).on(loadWorldInfoEntityBindingsFx.doneData, (_, items) => items);

export const $worldInfoEntityBookByProfileId = createStore<Record<string, string | null>>({}).on(
	$worldInfoEntityBindings,
	(_, bindings) => {
		const grouped: Record<string, WorldInfoBindingDto[]> = {};
		bindings.forEach((binding) => {
			if (!binding.enabled || !binding.scopeId) return;
			if (!grouped[binding.scopeId]) {
				grouped[binding.scopeId] = [];
			}
			grouped[binding.scopeId].push(binding);
		});

		const map: Record<string, string | null> = {};
		Object.keys(grouped).forEach((profileId) => {
			const sorted = grouped[profileId].slice().sort((a, b) => a.displayOrder - b.displayOrder);
			map[profileId] = sorted[0]?.bookId ?? null;
		});
		return map;
	},
);

export const $isWorldInfoBookBoundToCurrentChat = combine(
	$worldInfoChatBindings,
	$selectedWorldInfoBookId,
	(bindings, selectedBookId) => {
		if (!selectedBookId) return false;
		return bindings.some((item) => item.bookId === selectedBookId && item.enabled);
	},
);

sample({
	clock: worldInfoRefreshRequested,
	target: [loadWorldInfoBooksFx, loadWorldInfoSettingsFx, loadWorldInfoEntityBindingsFx],
});

sample({
	clock: loadWorldInfoBooksFx.doneData,
	source: $selectedWorldInfoBookId,
	fn: (selectedId, items) => {
		if (selectedId && items.some((item) => item.id === selectedId)) return selectedId;
		return items[0]?.id ?? null;
	},
	target: worldInfoBookSelected,
});

sample({
	clock: worldInfoBookSelected,
	filter: (id): id is string => Boolean(id),
	target: loadWorldInfoBookFx,
});

sample({
	clock: worldInfoBookSelected,
	filter: (id) => !id,
	target: clearSelectedWorldInfoBook,
});

sample({
	clock: worldInfoBookCreateRequested,
	target: createWorldInfoBookFx,
});

sample({
	clock: worldInfoBookDuplicateRequested,
	target: duplicateWorldInfoBookFx,
});

sample({
	clock: worldInfoBookDeleteRequested,
	target: deleteWorldInfoBookFx,
});

sample({
	clock: worldInfoBookSaveRequested,
	target: saveWorldInfoBookFx,
});

sample({
	clock: worldInfoSettingsSaveRequested,
	target: saveWorldInfoSettingsFx,
});

sample({
	clock: worldInfoImportBookRequested,
	target: importWorldInfoBookFx,
});

sample({
	clock: [createWorldInfoBookFx.doneData, duplicateWorldInfoBookFx.doneData, importWorldInfoBookFx.doneData],
	fn: (result) => ('book' in result ? result.book.id : result.id),
	target: worldInfoBookSelected,
});

sample({
	clock: [createWorldInfoBookFx.doneData, duplicateWorldInfoBookFx.doneData, deleteWorldInfoBookFx.doneData, importWorldInfoBookFx.doneData],
	target: loadWorldInfoBooksFx,
});

sample({
	clock: [deleteWorldInfoBookFx.doneData, importWorldInfoBookFx.doneData],
	target: loadWorldInfoEntityBindingsFx,
});

sample({
	clock: saveWorldInfoBookFx.doneData,
	target: loadWorldInfoBooksFx,
});

sample({
	clock: setOpenedChat,
	fn: ({ chat }) => ({ chatId: chat.id }),
	target: loadWorldInfoChatBindingsFx,
});

sample({
	clock: worldInfoBookBindingToggleRequested,
	source: $currentChat,
	filter: (chat): chat is ChatDto => Boolean(chat?.id),
	fn: (chat, payload) => ({
		chatId: chat!.id,
		bookId: payload.bookId,
		enabled: payload.enabled,
	}),
	target: setWorldInfoBookBoundToCurrentChatFx,
});

sample({
	clock: setWorldInfoBookBoundToEntityRequested,
	target: setWorldInfoBookBoundToEntityFx,
});

sample({
	clock: setWorldInfoBookBoundToEntityFx.doneData,
	target: loadWorldInfoEntityBindingsFx,
});

createWorldInfoBookFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.createErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

duplicateWorldInfoBookFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.duplicateErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

deleteWorldInfoBookFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.deleteErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

saveWorldInfoBookFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('worldInfo.toasts.bookSaved') });
});

saveWorldInfoBookFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.saveBookErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

saveWorldInfoSettingsFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('worldInfo.toasts.settingsSaved') });
});

saveWorldInfoSettingsFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.saveSettingsErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

setWorldInfoBookBoundToCurrentChatFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('worldInfo.toasts.bindingUpdated') });
});

setWorldInfoBookBoundToCurrentChatFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.bindingUpdateErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

setWorldInfoBookBoundToEntityFx.done.watch(({ params }) => {
	if (params.silent) return;
	toaster.success({ title: i18n.t('worldInfo.toasts.bindingUpdated') });
});

setWorldInfoBookBoundToEntityFx.fail.watch(({ params, error }) => {
	if (params.silent) return;
	toaster.error({ title: i18n.t('worldInfo.toasts.bindingUpdateErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

importWorldInfoBookFx.doneData.watch((result) => {
	const warningSuffix = result.warnings.length > 0 ? ` (${result.warnings.join('; ')})` : '';
	toaster.success({ title: i18n.t('worldInfo.toasts.importedBook', { name: result.book.name, warningSuffix }) });
});

importWorldInfoBookFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.importErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

loadWorldInfoBooksFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.loadBooksErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

loadWorldInfoSettingsFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.loadSettingsErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

loadWorldInfoBookFx.failData.watch((error) => {
	toaster.error({ title: i18n.t('worldInfo.toasts.loadBookErrorTitle'), description: error instanceof Error ? error.message : String(error) });
});

export const worldInfoInitRequested = worldInfoRefreshRequested;
