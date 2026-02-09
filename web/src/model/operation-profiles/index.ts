import { createEffect, createEvent, createStore, sample } from 'effector';
import { v4 as uuidv4 } from 'uuid';

import { toaster } from '@ui/toaster';
import i18n from '../../i18n';

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

export const loadOperationProfilesFx = createEffect(async (): Promise<OperationProfileDto[]> => {
	return listOperationProfiles();
});

export const $operationProfiles = createStore<OperationProfileDto[]>([]).on(loadOperationProfilesFx.doneData, (_, p) => p);

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
			name: i18n.t('operationProfiles.defaults.copyName', { name: src.name }),
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
	target: setActiveOperationProfileRequested,
});

sample({
	clock: [createOperationProfileFx.doneData, updateOperationProfileFx.doneData, deleteOperationProfileFx.doneData],
	target: loadOperationProfilesFx,
});

// If active profile is missing (deleted or not set), auto-pick the first available profile.
sample({
	clock: loadOperationProfilesFx.doneData,
	source: $operationProfileSettings,
	filter: (settings, profiles) => {
		if (!settings) return false;
		const activeProfileId = settings.activeProfileId;
		const hasActive = Boolean(activeProfileId && profiles.some((p) => p.profileId === activeProfileId));
		return !hasActive && profiles.length > 0;
	},
	fn: (_, profiles) => profiles[0]!.profileId,
	target: setActiveOperationProfileRequested,
});

createOperationProfileFx.doneData.watch((p) => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.created'), description: `${p.name} (v${p.version})` });
});
createOperationProfileFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.createError'), description: e instanceof Error ? e.message : String(e) });
});
updateOperationProfileFx.doneData.watch((p) => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.saved'), description: `${p.name} (v${p.version})` });
});
updateOperationProfileFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.saveError'), description: e instanceof Error ? e.message : String(e) });
});
deleteOperationProfileFx.doneData.watch(() => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.deleted') });
});
deleteOperationProfileFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.deleteError'), description: e instanceof Error ? e.message : String(e) });
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
	target: setActiveOperationProfileRequested,
});

sample({
	clock: importOperationProfilesFx.doneData,
	target: loadOperationProfilesFx,
});

importOperationProfilesFx.doneData.watch((p) => {
	toaster.success({ title: i18n.t('operationProfiles.toasts.importTitle'), description: i18n.t('operationProfiles.toasts.importedCount', { count: p.created.length }) });
});
importOperationProfilesFx.failData.watch((e) => {
	toaster.error({ title: i18n.t('operationProfiles.toasts.importError'), description: e instanceof Error ? e.message : String(e) });
});
