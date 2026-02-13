import { combine, createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';
import i18n from '../../i18n';

import type { InstructionDto } from '../../api/instructions';
import {
	createInstruction,
	deleteInstruction,
	listInstructions,
	updateInstruction,
} from '../../api/instructions';
import { $currentChat, setChatInstructionRequested, setOpenedChat } from '../chat-core';

function isInstructionDto(value: unknown): value is InstructionDto {
	if (!value || typeof value !== 'object') return false;
	const item = value as Record<string, unknown>;
	return (
		typeof item.id === 'string' &&
		item.id.trim().length > 0 &&
		typeof item.name === 'string' &&
		typeof item.templateText === 'string' &&
		(item.engine === 'liquidjs')
	);
}

export const loadInstructionsFx = createEffect(async () => {
	const raw = await listInstructions();
	return raw.filter(isInstructionDto);
});

export const $instructions = createStore<InstructionDto[]>([]).on(loadInstructionsFx.doneData, (_, items) => items);

export const setSelectedInstructionId = createEvent<string | null>();
export const $selectedInstructionId = createStore<string | null>(null).on(
	setSelectedInstructionId,
	(_, id) => id,
);

export const $selectedInstruction = combine($instructions, $selectedInstructionId, (items, id) => {
	if (!id) return null;
	return items.find((t) => t.id === id) ?? null;
});

export const instructionSelected = createEvent<string>();

const refreshRequested = createEvent();

sample({
	clock: refreshRequested,
	target: loadInstructionsFx,
});

// Sync selection from current chat on chat open.
sample({
	clock: setOpenedChat,
	fn: ({ chat }) => chat.instructionId,
	target: setSelectedInstructionId,
});

// Pick a valid template when list or chat changes.
sample({
	clock: loadInstructionsFx.doneData,
	source: { selectedId: $selectedInstructionId, chat: $currentChat },
	fn: ({ selectedId, chat }, items) => {
		if (items.length === 0) return null;
		const ids = new Set(items.map((t) => t.id));

		const chatId = chat?.instructionId ?? null;
		if (chatId && ids.has(chatId)) return chatId;
		if (selectedId && ids.has(selectedId)) return selectedId;
		return items[0]?.id ?? null;
	},
	target: setSelectedInstructionId,
});

// If the chat points to a missing instruction (e.g. it was deleted), move it to the first available instruction.
sample({
	clock: loadInstructionsFx.doneData,
	source: $currentChat,
	filter: (chat, items) => Boolean(chat?.id) && Boolean(chat?.instructionId) && !items.some((t) => t.id === chat?.instructionId),
	fn: (_chat, items) => ({ instructionId: items[0]?.id ?? null }),
	target: setChatInstructionRequested,
});

// If the chat has no instruction, auto-assign the first available instruction.
sample({
	clock: [setOpenedChat, loadInstructionsFx.doneData],
	source: { chat: $currentChat, instructions: $instructions },
	filter: ({ chat, instructions }) => Boolean(chat?.id) && !chat?.instructionId && instructions.length > 0,
	fn: ({ instructions }) => instructions[0].id,
	target: setSelectedInstructionId,
});

sample({
	clock: [setOpenedChat, loadInstructionsFx.doneData],
	source: { chat: $currentChat, instructions: $instructions },
	filter: ({ chat, instructions }) => Boolean(chat?.id) && !chat?.instructionId && instructions.length > 0,
	fn: ({ instructions }) => ({ instructionId: instructions[0].id }),
	target: setChatInstructionRequested,
});

sample({
	clock: instructionSelected,
	fn: (id) => id,
	target: setSelectedInstructionId,
});

sample({
	clock: instructionSelected,
	source: $currentChat,
	filter: (chat, id) => Boolean(chat?.id) && chat?.instructionId !== id,
	fn: (_chat, id) => ({ instructionId: id }),
	target: setChatInstructionRequested,
});

export const createInstructionFx = createEffect(
	async (params: { name: string; templateText: string; meta?: unknown }) => {
		return createInstruction({
			name: params.name,
			templateText: params.templateText,
			meta: params.meta,
		});
	},
);

export const updateInstructionFx = createEffect(
	async (params: { id: string; name: string; templateText: string }) => {
		return updateInstruction({
			id: params.id,
			name: params.name,
			templateText: params.templateText,
		});
	},
);

export const deleteInstructionFx = createEffect(async (params: { id: string }) => deleteInstruction(params.id));

export const createInstructionRequested = createEvent();
export const duplicateInstructionRequested = createEvent<{ id: string }>();
export const importInstructionRequested = createEvent<{ name: string; templateText: string; meta?: unknown }>();
export const updateInstructionRequested = createEvent<{ id: string; name: string; templateText: string }>();
export const deleteInstructionRequested = createEvent<{ id: string }>();

sample({
	clock: createInstructionRequested,
	fn: () => ({
		name: i18n.t('instructions.defaults.newInstruction'),
		templateText: '{{char.name}}',
	}),
	target: createInstructionFx,
});

sample({
	clock: duplicateInstructionRequested,
	source: $instructions,
	filter: (items, payload) => items.some((t) => t.id === payload.id),
	fn: (items, payload) => {
		const tpl = items.find((t) => t.id === payload.id)!;
		return {
			name: `${tpl.name} (copy)`,
			templateText: tpl.templateText,
			meta: { duplicatedFromId: tpl.id, source: 'duplicate' },
		};
	},
	target: createInstructionFx,
});

sample({
	clock: importInstructionRequested,
	fn: (payload) => payload,
	target: createInstructionFx,
});

sample({
	clock: updateInstructionRequested,
	target: updateInstructionFx,
});

sample({
	clock: deleteInstructionRequested,
	target: deleteInstructionFx,
});

sample({
	clock: createInstructionFx.doneData,
	fn: (created) => created.id,
	target: setSelectedInstructionId,
});

sample({
	clock: createInstructionFx.doneData,
	fn: (created) => ({ instructionId: created.id }),
	target: setChatInstructionRequested,
});

sample({
	clock: [createInstructionFx.doneData, updateInstructionFx.doneData, deleteInstructionFx.doneData],
	target: refreshRequested,
});

createInstructionFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('instructions.toasts.createErrorTitle'),
		description: error instanceof Error ? error.message : String(error),
	});
});

updateInstructionFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('instructions.toasts.saveErrorTitle'),
		description: error instanceof Error ? error.message : String(error),
	});
});

deleteInstructionFx.failData.watch((error) => {
	toaster.error({
		title: i18n.t('instructions.toasts.deleteErrorTitle'),
		description: error instanceof Error ? error.message : String(error),
	});
});

// Initial load on app start. Expose a manual trigger as well.
export const instructionsInitRequested = refreshRequested;

