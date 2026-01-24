import { createEffect, createEvent, createStore, sample } from 'effector';
import { v4 as uuidv4 } from 'uuid';

import {
	createOperationProfile,
	deleteOperationProfile,
	exportOperationProfile,
	getActiveOperationProfile,
	importOperationProfiles,
	listOperationProfiles,
	setActiveOperationProfile,
	updateOperationProfile,
	type OperationProfileSettingsDto,
	type OperationProfileDto,
} from '../../api/chat-core';
import type { OperationProfileExport, OperationProfileUpsertInput } from '@shared/types/operation-profiles';
import { toaster } from '@ui/toaster';

export const loadOperationProfilesFx = createEffect(async (): Promise<OperationProfileDto[]> => {
	return listOperationProfiles();
});

export const $operationProfiles = createStore<OperationProfileDto[]>([]).on(loadOperationProfilesFx.doneData, (_, p) => p);

export const selectOperationProfileForEdit = createEvent<string | null>();
export const $selectedOperationProfileId = createStore<string | null>(null).on(selectOperationProfileForEdit, (_, id) => id);

sample({
	clock: loadOperationProfilesFx.doneData,
	source: $selectedOperationProfileId,
	filter: (selectedId, profiles) => !selectedId && profiles.length > 0,
	fn: (_, profiles) => profiles[0]!.profileId,
	target: selectOperationProfileForEdit,
});

export const createOperationProfileFx = createEffect(async (input: OperationProfileUpsertInput) => {
	return createOperationProfile({ input });
});

export const updateOperationProfileFx = createEffect(async (params: { profileId: string; patch: Partial<OperationProfileUpsertInput> }) => {
	return updateOperationProfile({ profileId: params.profileId, patch: params.patch });
});

export const deleteOperationProfileFx = createEffect(async (params: { profileId: string }) => {
	return deleteOperationProfile(params.profileId);
});

export const duplicateOperationProfileRequested = createEvent<{ sourceProfileId: string }>();

sample({
	clock: duplicateOperationProfileRequested,
	source: $operationProfiles,
	filter: (profiles, payload) => profiles.some((p) => p.profileId === payload.sourceProfileId),
	fn: (profiles, payload): OperationProfileUpsertInput => {
		const src = profiles.find((p) => p.profileId === payload.sourceProfileId)!;
		return {
			name: `${src.name} (copy)`,
			description: src.description,
			enabled: src.enabled,
			executionMode: src.executionMode,
			operationProfileSessionId: uuidv4(),
			operations: src.operations,
			meta: src.meta ?? undefined,
		};
	},
	target: createOperationProfileFx,
});

sample({
	clock: createOperationProfileFx.doneData,
	fn: (created) => created.profileId,
	target: selectOperationProfileForEdit,
});

sample({
	clock: [createOperationProfileFx.doneData, updateOperationProfileFx.doneData, deleteOperationProfileFx.doneData],
	target: loadOperationProfilesFx,
});

sample({
	clock: deleteOperationProfileFx.doneData,
	source: $selectedOperationProfileId,
	filter: (selectedId, deleted) => Boolean(selectedId && selectedId === deleted.id),
	fn: () => null,
	target: selectOperationProfileForEdit,
});

createOperationProfileFx.doneData.watch((p) => {
	toaster.success({ title: 'OperationProfile создан', description: `${p.name} (v${p.version})` });
});
createOperationProfileFx.failData.watch((e) => {
	toaster.error({ title: 'Не удалось создать OperationProfile', description: e instanceof Error ? e.message : String(e) });
});
updateOperationProfileFx.doneData.watch((p) => {
	toaster.success({ title: 'OperationProfile сохранён', description: `${p.name} (v${p.version})` });
});
updateOperationProfileFx.failData.watch((e) => {
	toaster.error({ title: 'Не удалось сохранить OperationProfile', description: e instanceof Error ? e.message : String(e) });
});
deleteOperationProfileFx.doneData.watch(() => {
	toaster.success({ title: 'OperationProfile удалён' });
});
deleteOperationProfileFx.failData.watch((e) => {
	toaster.error({ title: 'Не удалось удалить OperationProfile', description: e instanceof Error ? e.message : String(e) });
});

// ---- Active profile (global)

export const loadActiveOperationProfileFx = createEffect(async (): Promise<OperationProfileSettingsDto> => {
	return getActiveOperationProfile();
});

export const $operationProfileSettings = createStore<OperationProfileSettingsDto | null>(null).on(
	loadActiveOperationProfileFx.doneData,
	(_, data) => data,
);

export const setActiveOperationProfileRequested = createEvent<string | null>();

export const setActiveOperationProfileFx = createEffect(async (activeProfileId: string | null) => {
	return setActiveOperationProfile(activeProfileId);
});

sample({ clock: setActiveOperationProfileRequested, target: setActiveOperationProfileFx });

sample({
	clock: setActiveOperationProfileFx.doneData,
	target: loadActiveOperationProfileFx,
});

// ---- Import / export

export const exportOperationProfileFx = createEffect(async (profileId: string): Promise<OperationProfileExport> => {
	return exportOperationProfile(profileId);
});

export const importOperationProfilesFx = createEffect(
	async (items: OperationProfileExport | OperationProfileExport[]): Promise<{ created: OperationProfileDto[] }> => {
		return importOperationProfiles({ items });
	},
);

sample({
	clock: importOperationProfilesFx.doneData,
	fn: (payload) => payload.created[0]?.profileId ?? null,
	target: selectOperationProfileForEdit,
});

sample({
	clock: importOperationProfilesFx.doneData,
	target: loadOperationProfilesFx,
});

importOperationProfilesFx.doneData.watch((p) => {
	toaster.success({ title: 'Импорт OperationProfile', description: `Импортировано: ${p.created.length}` });
});
importOperationProfilesFx.failData.watch((e) => {
	toaster.error({ title: 'Не удалось импортировать', description: e instanceof Error ? e.message : String(e) });
});

