import { combine, createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';

import type { PromptTemplateDto } from '../../api/prompt-templates';
import {
	createPromptTemplate,
	deletePromptTemplate,
	listPromptTemplates,
	updatePromptTemplate,
} from '../../api/prompt-templates';
import { $currentChat, setChatPromptTemplateRequested, setOpenedChat } from '../chat-core';

export const loadPromptTemplatesFx = createEffect(async () => {
	return listPromptTemplates();
});

export const $promptTemplates = createStore<PromptTemplateDto[]>([]).on(loadPromptTemplatesFx.doneData, (_, items) => items);

export const setSelectedPromptTemplateId = createEvent<string | null>();
export const $selectedPromptTemplateId = createStore<string | null>(null).on(
	setSelectedPromptTemplateId,
	(_, id) => id,
);

export const $selectedPromptTemplate = combine($promptTemplates, $selectedPromptTemplateId, (items, id) => {
	if (!id) return null;
	return items.find((t) => t.id === id) ?? null;
});

export const promptTemplateSelected = createEvent<string>();

const refreshRequested = createEvent();

sample({
	clock: refreshRequested,
	target: loadPromptTemplatesFx,
});

// Sync selection from current chat on chat open.
sample({
	clock: setOpenedChat,
	fn: ({ chat }) => chat.promptTemplateId,
	target: setSelectedPromptTemplateId,
});

// Pick a valid template when list or chat changes.
sample({
	clock: loadPromptTemplatesFx.doneData,
	source: { selectedId: $selectedPromptTemplateId, chat: $currentChat },
	fn: ({ selectedId, chat }, items) => {
		if (items.length === 0) return null;
		const ids = new Set(items.map((t) => t.id));

		const chatId = chat?.promptTemplateId ?? null;
		if (chatId && ids.has(chatId)) return chatId;
		if (selectedId && ids.has(selectedId)) return selectedId;
		return items[0]?.id ?? null;
	},
	target: setSelectedPromptTemplateId,
});

// If the chat points to a missing template (e.g. it was deleted), move it to the first available template.
sample({
	clock: loadPromptTemplatesFx.doneData,
	source: $currentChat,
	filter: (chat, items) => Boolean(chat?.id) && Boolean(chat?.promptTemplateId) && !items.some((t) => t.id === chat?.promptTemplateId),
	fn: (_chat, items) => ({ promptTemplateId: items[0]?.id ?? null }),
	target: setChatPromptTemplateRequested,
});

// If the chat has no prompt template, auto-assign the first available template.
sample({
	clock: [setOpenedChat, loadPromptTemplatesFx.doneData],
	source: { chat: $currentChat, templates: $promptTemplates },
	filter: ({ chat, templates }) => Boolean(chat?.id) && !chat?.promptTemplateId && templates.length > 0,
	fn: ({ templates }) => templates[0].id,
	target: setSelectedPromptTemplateId,
});

sample({
	clock: [setOpenedChat, loadPromptTemplatesFx.doneData],
	source: { chat: $currentChat, templates: $promptTemplates },
	filter: ({ chat, templates }) => Boolean(chat?.id) && !chat?.promptTemplateId && templates.length > 0,
	fn: ({ templates }) => ({ promptTemplateId: templates[0].id }),
	target: setChatPromptTemplateRequested,
});

sample({
	clock: promptTemplateSelected,
	fn: (id) => id,
	target: setSelectedPromptTemplateId,
});

sample({
	clock: promptTemplateSelected,
	source: $currentChat,
	filter: (chat, id) => Boolean(chat?.id) && chat?.promptTemplateId !== id,
	fn: (_chat, id) => ({ promptTemplateId: id }),
	target: setChatPromptTemplateRequested,
});

export const createPromptTemplateFx = createEffect(
	async (params: { name: string; templateText: string; meta?: unknown }) => {
		return createPromptTemplate({
			name: params.name,
			templateText: params.templateText,
			meta: params.meta,
		});
	},
);

export const updatePromptTemplateFx = createEffect(
	async (params: { id: string; name: string; templateText: string }) => {
		return updatePromptTemplate({
			id: params.id,
			name: params.name,
			templateText: params.templateText,
		});
	},
);

export const deletePromptTemplateFx = createEffect(async (params: { id: string }) => deletePromptTemplate(params.id));

export const createPromptTemplateRequested = createEvent();
export const duplicatePromptTemplateRequested = createEvent<{ id: string }>();
export const importPromptTemplateRequested = createEvent<{ name: string; templateText: string; meta?: unknown }>();
export const updatePromptTemplateRequested = createEvent<{ id: string; name: string; templateText: string }>();
export const deletePromptTemplateRequested = createEvent<{ id: string }>();

sample({
	clock: createPromptTemplateRequested,
	fn: () => ({
		name: 'New template',
		templateText: '{{char.name}}',
	}),
	target: createPromptTemplateFx,
});

sample({
	clock: duplicatePromptTemplateRequested,
	source: $promptTemplates,
	filter: (items, payload) => items.some((t) => t.id === payload.id),
	fn: (items, payload) => {
		const tpl = items.find((t) => t.id === payload.id)!;
		return {
			name: `${tpl.name} (copy)`,
			templateText: tpl.templateText,
			meta: { duplicatedFromId: tpl.id, source: 'duplicate' },
		};
	},
	target: createPromptTemplateFx,
});

sample({
	clock: importPromptTemplateRequested,
	fn: (payload) => payload,
	target: createPromptTemplateFx,
});

sample({
	clock: updatePromptTemplateRequested,
	target: updatePromptTemplateFx,
});

sample({
	clock: deletePromptTemplateRequested,
	target: deletePromptTemplateFx,
});

sample({
	clock: createPromptTemplateFx.doneData,
	fn: (created) => created.id,
	target: setSelectedPromptTemplateId,
});

sample({
	clock: createPromptTemplateFx.doneData,
	fn: (created) => ({ promptTemplateId: created.id }),
	target: setChatPromptTemplateRequested,
});

sample({
	clock: [createPromptTemplateFx.doneData, updatePromptTemplateFx.doneData, deletePromptTemplateFx.doneData],
	target: refreshRequested,
});

createPromptTemplateFx.failData.watch((error) => {
	toaster.error({
		title: 'Не удалось создать шаблон',
		description: error instanceof Error ? error.message : String(error),
	});
});

updatePromptTemplateFx.failData.watch((error) => {
	toaster.error({
		title: 'Не удалось сохранить шаблон',
		description: error instanceof Error ? error.message : String(error),
	});
});

deletePromptTemplateFx.failData.watch((error) => {
	toaster.error({
		title: 'Не удалось удалить шаблон',
		description: error instanceof Error ? error.message : String(error),
	});
});

// Initial load on app start. Expose a manual trigger as well.
export const promptTemplatesInitRequested = refreshRequested;

