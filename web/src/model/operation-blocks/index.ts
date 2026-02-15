import { createEffect, createEvent, createStore, sample } from 'effector';

import { toaster } from '@ui/toaster';

import {
	createOperationBlock,
	deleteOperationBlock,
	exportOperationBlock,
	importOperationBlocks,
	listOperationBlocks,
	updateOperationBlock,
	type OperationBlockDto,
} from '../../api/chat-core';
import i18n from '../../i18n';

import type { OperationBlockExport } from '@shared/types/operation-profiles';

export const loadOperationBlocksFx = createEffect(async (): Promise<OperationBlockDto[]> => {
	return listOperationBlocks();
});

export const $operationBlocks = createStore<OperationBlockDto[]>([]).on(loadOperationBlocksFx.doneData, (_, blocks) => blocks);

export const createOperationBlockFx = createEffect(async (input: {
	name: string;
	description?: string;
	enabled: boolean;
	operations: OperationBlockDto['operations'];
	meta?: unknown;
}) => {
	return createOperationBlock({ input });
});

export const updateOperationBlockFx = createEffect(async (params: {
	blockId: string;
	patch: Partial<{
		name: string;
		description?: string;
		enabled: boolean;
		operations: OperationBlockDto['operations'];
		meta?: unknown;
	}>;
}) => {
	return updateOperationBlock({ blockId: params.blockId, patch: params.patch });
});

export const deleteOperationBlockFx = createEffect(async (params: { blockId: string }) => {
	return deleteOperationBlock(params.blockId);
});

export const duplicateOperationBlockRequested = createEvent<{ sourceBlockId: string }>();

sample({
	clock: duplicateOperationBlockRequested,
	source: $operationBlocks,
	filter: (blocks, payload) => blocks.some((b) => b.blockId === payload.sourceBlockId),
	fn: (blocks, payload) => {
		const src = blocks.find((b) => b.blockId === payload.sourceBlockId)!;
		return {
			name: i18n.t('operationProfiles.defaults.copyName', { name: src.name }),
			description: src.description,
			enabled: src.enabled,
			operations: src.operations,
			meta: src.meta ?? undefined,
		};
	},
	target: createOperationBlockFx,
});

sample({
	clock: [createOperationBlockFx.doneData, updateOperationBlockFx.doneData, deleteOperationBlockFx.doneData],
	target: loadOperationBlocksFx,
});

export const exportOperationBlockFx = createEffect(async (blockId: string): Promise<OperationBlockExport> => {
	return exportOperationBlock(blockId);
});

export const importOperationBlocksFx = createEffect(
	async (items: OperationBlockExport | OperationBlockExport[]): Promise<{ created: OperationBlockDto[] }> => {
		return importOperationBlocks({ items });
	},
);

sample({
	clock: importOperationBlocksFx.doneData,
	target: loadOperationBlocksFx,
});

createOperationBlockFx.doneData.watch((b) => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.created'), description: b.name });
});
createOperationBlockFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.createError'), description: e instanceof Error ? e.message : String(e) });
});
updateOperationBlockFx.doneData.watch((b) => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.saved'), description: b.name });
});
updateOperationBlockFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.saveError'), description: e instanceof Error ? e.message : String(e) });
});
deleteOperationBlockFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.deleted') });
});
deleteOperationBlockFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.deleteError'), description: e instanceof Error ? e.message : String(e) });
});
importOperationBlocksFx.doneData.watch((p) => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.importTitle'), description: i18n.t('operationProfiles.toasts.importedCount', { count: p.created.length }) });
});
importOperationBlocksFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.importError'), description: e instanceof Error ? e.message : String(e) });
});
