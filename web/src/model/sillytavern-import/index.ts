import { combine, createEffect, createEvent, createStore, sample } from 'effector';

import {
	importSillyTavernSelection,
	scanSillyTavernImport,
} from '../../api/sillytavern-import';
import { loadEntityProfilesFx } from '../chat-core';
import { loadInstructionsFx } from '../instructions';
import { samplersModel } from '../samplers';
import { userPersonsModel } from '../user-persons';
import { loadWorldInfoBooksFx, loadWorldInfoEntityBindingsFx } from '../world-info';

import type {
	SillyTavernImportKind,
	SillyTavernImportResult,
	SillyTavernImportScanItem,
	SillyTavernImportScanResult,
} from '@shared/types/sillytavern-import';

const DEFAULT_ROOT = 'F:\\SillyTavern';
const DEFAULT_OWNER_ID = 'global';

export const SILLYTAVERN_IMPORT_KINDS: SillyTavernImportKind[] = [
	'character',
	'persona',
	'world_info',
	'instruction',
	'sampler',
	'chat',
];

export const sillyTavernRootChanged = createEvent<string>();
export const sillyTavernScanRequested = createEvent();
export const sillyTavernImportRequested = createEvent();
export const sillyTavernItemToggled = createEvent<{ itemId: string; checked: boolean }>();
export const sillyTavernKindToggled = createEvent<{ kind: SillyTavernImportKind; checked: boolean }>();
export const sillyTavernProfileToggled = createEvent<{ profileHandle: string; checked: boolean }>();
export const sillyTavernSelectionCleared = createEvent();
const sillyTavernSelectionReplaced = createEvent<Set<string>>();

export const scanSillyTavernImportFx = createEffect(async (rootPath: string): Promise<SillyTavernImportScanResult> => {
	return scanSillyTavernImport({ rootPath });
});

export const importSillyTavernSelectionFx = createEffect(
	async (params: { rootPath: string; itemIds: string[] }): Promise<SillyTavernImportResult> => {
		return importSillyTavernSelection({
			rootPath: params.rootPath,
			ownerId: DEFAULT_OWNER_ID,
			selection: { itemIds: params.itemIds },
		});
	},
);

export const $sillyTavernRootPath = createStore(DEFAULT_ROOT).on(sillyTavernRootChanged, (_, value) => value);

export const $sillyTavernScanResult = createStore<SillyTavernImportScanResult | null>(null).on(
	scanSillyTavernImportFx.doneData,
	(_, result) => result,
);

export const $sillyTavernImportResult = createStore<SillyTavernImportResult | null>(null)
	.on(importSillyTavernSelectionFx.doneData, (_, result) => result)
	.reset(scanSillyTavernImportFx.done);

export const $sillyTavernScanError = createStore<string | null>(null)
	.on(scanSillyTavernImportFx.failData, (_, error) => (error instanceof Error ? error.message : String(error)))
	.reset(scanSillyTavernImportFx, scanSillyTavernImportFx.done);

export const $sillyTavernImportError = createStore<string | null>(null)
	.on(importSillyTavernSelectionFx.failData, (_, error) => (error instanceof Error ? error.message : String(error)))
	.reset(importSillyTavernSelectionFx, importSillyTavernSelectionFx.done);

export const $sillyTavernSelectedItemIds = createStore<Set<string>>(new Set())
	.on(scanSillyTavernImportFx.doneData, (_, result) => new Set(listItems(result).map((item) => item.id)))
	.on(sillyTavernSelectionReplaced, (_, next) => next)
	.on(sillyTavernItemToggled, (state, payload) => {
		const next = new Set(state);
		if (payload.checked) next.add(payload.itemId);
		else next.delete(payload.itemId);
		return next;
	})
	.reset(sillyTavernSelectionCleared);

export const $sillyTavernSelectedCount = $sillyTavernSelectedItemIds.map((items) => items.size);

export const $sillyTavernIsBusy = combine(
	scanSillyTavernImportFx.pending,
	importSillyTavernSelectionFx.pending,
	(scanPending, importPending) => scanPending || importPending,
);

export function listProfileItems(profile: SillyTavernImportScanResult['profiles'][number] | undefined): SillyTavernImportScanItem[] {
	if (!profile) return [];
	return SILLYTAVERN_IMPORT_KINDS.flatMap((kind) => profile.items[kind]);
}

export function listItems(scan: SillyTavernImportScanResult | null): SillyTavernImportScanItem[] {
	if (!scan) return [];
	return scan.profiles.flatMap(listProfileItems);
}

export function applyKindSelection(params: {
	scan: SillyTavernImportScanResult | null;
	selectedIds: Set<string>;
	kind: SillyTavernImportKind;
	checked: boolean;
}): Set<string> {
	const next = new Set(params.selectedIds);
	for (const item of listItems(params.scan).filter((entry) => entry.kind === params.kind)) {
		if (params.checked) next.add(item.id);
		else next.delete(item.id);
	}
	return next;
}

export function applyProfileSelection(params: {
	scan: SillyTavernImportScanResult | null;
	selectedIds: Set<string>;
	profileHandle: string;
	checked: boolean;
}): Set<string> {
	const next = new Set(params.selectedIds);
	const profile = params.scan?.profiles.find((item) => item.handle === params.profileHandle);
	for (const item of listProfileItems(profile)) {
		if (params.checked) next.add(item.id);
		else next.delete(item.id);
	}
	return next;
}

sample({
	clock: sillyTavernScanRequested,
	source: $sillyTavernRootPath,
	target: scanSillyTavernImportFx,
});

sample({
	clock: sillyTavernKindToggled,
	source: {
		scan: $sillyTavernScanResult,
		selectedIds: $sillyTavernSelectedItemIds,
	},
	fn: ({ scan, selectedIds }, payload) =>
		applyKindSelection({ scan, selectedIds, kind: payload.kind, checked: payload.checked }),
	target: sillyTavernSelectionReplaced,
});

sample({
	clock: sillyTavernProfileToggled,
	source: {
		scan: $sillyTavernScanResult,
		selectedIds: $sillyTavernSelectedItemIds,
	},
	fn: ({ scan, selectedIds }, payload) =>
		applyProfileSelection({
			scan,
			selectedIds,
			profileHandle: payload.profileHandle,
			checked: payload.checked,
		}),
	target: sillyTavernSelectionReplaced,
});

sample({
	clock: sillyTavernImportRequested,
	source: {
		rootPath: $sillyTavernRootPath,
		itemIds: $sillyTavernSelectedItemIds,
	},
	fn: ({ rootPath, itemIds }) => ({ rootPath, itemIds: Array.from(itemIds) }),
	target: importSillyTavernSelectionFx,
});

sample({
	clock: importSillyTavernSelectionFx.doneData,
	target: [
		loadEntityProfilesFx,
		userPersonsModel.getItemsFx,
		loadWorldInfoBooksFx,
		loadWorldInfoEntityBindingsFx,
		loadInstructionsFx,
		samplersModel.getItemsFx,
	],
});
