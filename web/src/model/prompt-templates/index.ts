import { combine, createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';

import type { PromptTemplateDto, PromptTemplateScope } from '../../api/prompt-templates';
import {
	createPromptTemplate,
	deletePromptTemplate,
	listPromptTemplates,
	updatePromptTemplate,
} from '../../api/prompt-templates';
import { $currentChat, $currentEntityProfile, setOpenedChat, selectEntityProfile } from '../chat-core';

export const setPromptTemplateScope = createEvent<PromptTemplateScope>();
export const $promptTemplateScope = createStore<PromptTemplateScope>('chat').on(setPromptTemplateScope, (_, s) => s);

const $scopeId = combine($promptTemplateScope, $currentEntityProfile, $currentChat, (scope, profile, chat) => {
	if (scope === 'global') return null;
	if (scope === 'entity_profile') return profile?.id ?? null;
	return chat?.id ?? null;
});

export const loadPromptTemplatesFx = createEffect(async (params: { scope: PromptTemplateScope; scopeId: string | null }) => {
	return listPromptTemplates({ scope: params.scope, scopeId: params.scopeId ?? undefined });
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

const refreshRequested = createEvent();

sample({
	clock: [refreshRequested, setPromptTemplateScope, setOpenedChat, selectEntityProfile],
	source: { scope: $promptTemplateScope, scopeId: $scopeId },
	filter: ({ scope, scopeId }) => scope === 'global' || Boolean(scopeId),
	fn: ({ scope, scopeId }) => ({ scope, scopeId }),
	target: loadPromptTemplatesFx,
});

// Pick first template when list changes.
sample({
	clock: loadPromptTemplatesFx.doneData,
	source: $selectedPromptTemplateId,
	filter: (selectedId, items) => !selectedId || !items.some((t) => t.id === selectedId),
	fn: (_, items) => items[0]?.id ?? null,
	target: setSelectedPromptTemplateId,
});

export const createPromptTemplateFx = createEffect(
	async (params: { name: string; templateText: string; enabled: boolean; scope: PromptTemplateScope; scopeId: string | null }) => {
		return createPromptTemplate({
			name: params.name,
			templateText: params.templateText,
			enabled: params.enabled,
			scope: params.scope,
			scopeId: params.scopeId ?? undefined,
		});
	},
);

export const updatePromptTemplateFx = createEffect(
	async (params: { id: string; name: string; templateText: string; enabled: boolean }) => {
		return updatePromptTemplate({
			id: params.id,
			name: params.name,
			enabled: params.enabled,
			templateText: params.templateText,
		});
	},
);

export const deletePromptTemplateFx = createEffect(async (params: { id: string }) => deletePromptTemplate(params.id));

export const createPromptTemplateRequested = createEvent();
export const updatePromptTemplateRequested = createEvent<{ id: string; name: string; templateText: string; enabled: boolean }>();
export const deletePromptTemplateRequested = createEvent<{ id: string }>();

sample({
	clock: createPromptTemplateRequested,
	source: { scope: $promptTemplateScope, scopeId: $scopeId },
	filter: ({ scope, scopeId }) => scope === 'global' || Boolean(scopeId),
	fn: ({ scope, scopeId }) => ({
		name: 'New template',
		templateText: '{{char.name}}',
		enabled: true,
		scope,
		scopeId,
	}),
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

// Initial load on app start: the chat-core init opens a profile/chat; we rely on refreshRequested
// being triggered by those events. Expose a manual trigger as well.
export const promptTemplatesInitRequested = refreshRequested;

