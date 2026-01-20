import { createEffect, createEvent, createStore, sample } from 'effector';

import type { SseEnvelope } from '../../api/chat-core';
import {
	createPipelineProfile,
	deletePipelineProfile,
	getChatActivePipelineProfile,
	getChatPipelineDebug,
	getChatPipelineState,
	listPipelineProfiles,
	updatePipelineProfile,
	setChatActivePipelineProfile,
	setEntityProfileActivePipelineProfile,
	setGlobalActivePipelineProfile,
	type ChatActivePipelineProfileResponse,
	type ChatPipelineDebugDto,
	type ChatPipelineStateDto,
	type PipelineProfileDto,
} from '../../api/chat-core';
import { toaster } from '@ui/toaster';

export type PipelineRunStatus = 'running' | 'done' | 'aborted' | 'error';

export type PipelineRuntimeState = {
	chatId: string | null;
	branchId: string | null;
	runId: string | null;
	pipelineId: string | null;
	pipelineName: string | null;
	trigger: string | null;
	status: PipelineRunStatus | null;
	stepRunId: string | null;
	stepType: string | null;
	generationId: string | null;
	activeProfileId: string | null;
	activeProfileVersion: number | null;
	profileSource: string | null;
	lastError: { code?: string; message?: string } | null;
};

export const pipelineSseEnvelopeReceived = createEvent<SseEnvelope>();

export const $pipelineRuntime = createStore<PipelineRuntimeState>({
	chatId: null,
	branchId: null,
	runId: null,
	pipelineId: null,
	pipelineName: null,
	trigger: null,
	status: null,
	stepRunId: null,
	stepType: null,
	generationId: null,
	activeProfileId: null,
	activeProfileVersion: null,
	profileSource: null,
	lastError: null,
});

export const loadPipelineDebugFx = createEffect(async (params: { chatId: string; branchId?: string }) => {
	return getChatPipelineDebug(params);
});

export const $pipelineDebug = createStore<ChatPipelineDebugDto | null>(null).on(
	loadPipelineDebugFx.doneData,
	(_, data) => data,
);

export const refreshPipelineDebugRequested = createEvent<{ chatId: string; branchId?: string }>();

sample({
	clock: refreshPipelineDebugRequested,
	target: loadPipelineDebugFx,
});

export const loadChatPipelineStateFx = createEffect(async (params: { chatId: string; branchId?: string }) => {
	return getChatPipelineState(params);
});

export const $chatPipelineState = createStore<ChatPipelineStateDto | null>(null).on(
	loadChatPipelineStateFx.doneData,
	(_, data) => data,
);

export const refreshPipelineStateRequested = createEvent<{ chatId: string; branchId?: string }>();

sample({
	clock: refreshPipelineStateRequested,
	target: loadChatPipelineStateFx,
});

const schedulePipelineStatePollFx = createEffect(async (params: { chatId: string; branchId?: string; delayMs?: number }) => {
	await new Promise<void>((resolve) => {
		window.setTimeout(resolve, params.delayMs ?? 1500);
	});
	return { chatId: params.chatId, branchId: params.branchId };
});

// ---- Active profile UI helpers

export const loadPipelineProfilesFx = createEffect(async (): Promise<PipelineProfileDto[]> => {
	return listPipelineProfiles();
});

export const $pipelineProfiles = createStore<PipelineProfileDto[]>([]).on(loadPipelineProfilesFx.doneData, (_, p) => p);

export const selectPipelineProfileForEdit = createEvent<string | null>();
export const $selectedPipelineProfileId = createStore<string | null>(null).on(selectPipelineProfileForEdit, (_, id) => id);

sample({
	clock: loadPipelineProfilesFx.doneData,
	source: $selectedPipelineProfileId,
	filter: (selectedId, profiles) => !selectedId && profiles.length > 0,
	fn: (_, profiles) => profiles[0]!.id,
	target: selectPipelineProfileForEdit,
});

export const createPipelineProfileFx = createEffect(async (params: { name: string; spec: unknown; meta?: unknown }) => {
	return createPipelineProfile(params);
});

export const updatePipelineProfileFx = createEffect(async (params: { id: string; name?: string; spec?: unknown; meta?: unknown }) => {
	return updatePipelineProfile(params);
});

export const deletePipelineProfileFx = createEffect(async (params: { id: string }) => {
	return deletePipelineProfile(params.id);
});

export const duplicatePipelineProfileRequested = createEvent<{ sourceProfileId: string }>();

sample({
	clock: duplicatePipelineProfileRequested,
	source: $pipelineProfiles,
	filter: (profiles, payload) => profiles.some((p) => p.id === payload.sourceProfileId),
	fn: (profiles, payload) => {
		const src = profiles.find((p) => p.id === payload.sourceProfileId)!;
		return {
			name: `${src.name} (copy)`,
			spec: src.spec,
			meta: src.meta ?? undefined,
		};
	},
	target: createPipelineProfileFx,
});

// Reload list and select the created profile.
sample({
	clock: createPipelineProfileFx.doneData,
	fn: (created) => created.id,
	target: selectPipelineProfileForEdit,
});

sample({
	clock: [createPipelineProfileFx.doneData, updatePipelineProfileFx.doneData, deletePipelineProfileFx.doneData],
	target: loadPipelineProfilesFx,
});

// Best-effort selection cleanup after delete.
sample({
	clock: deletePipelineProfileFx.doneData,
	source: $selectedPipelineProfileId,
	filter: (selectedId, deleted) => Boolean(selectedId && selectedId === deleted.id),
	fn: () => null,
	target: selectPipelineProfileForEdit,
});

createPipelineProfileFx.doneData.watch((p) => {
	toaster.success({ title: 'PipelineProfile создан', description: `${p.name} (v${p.version})` });
});
createPipelineProfileFx.failData.watch((e) => {
	toaster.error({ title: 'Не удалось создать PipelineProfile', description: e instanceof Error ? e.message : String(e) });
});
updatePipelineProfileFx.doneData.watch((p) => {
	toaster.success({ title: 'PipelineProfile сохранён', description: `${p.name} (v${p.version})` });
});
updatePipelineProfileFx.failData.watch((e) => {
	toaster.error({ title: 'Не удалось сохранить PipelineProfile', description: e instanceof Error ? e.message : String(e) });
});
deletePipelineProfileFx.doneData.watch(() => {
	toaster.success({ title: 'PipelineProfile удалён' });
});
deletePipelineProfileFx.failData.watch((e) => {
	toaster.error({ title: 'Не удалось удалить PipelineProfile', description: e instanceof Error ? e.message : String(e) });
});

export const loadChatActivePipelineProfileFx = createEffect(async (params: { chatId: string }) => {
	return getChatActivePipelineProfile(params.chatId);
});

export const $chatActivePipelineProfile = createStore<ChatActivePipelineProfileResponse | null>(null).on(
	loadChatActivePipelineProfileFx.doneData,
	(_, data) => data,
);

// UX: if nothing is selected for editing yet, default to the resolved active profile (for current chat).
sample({
	clock: loadChatActivePipelineProfileFx.doneData,
	source: $selectedPipelineProfileId,
	filter: (selectedId, payload) => !selectedId && Boolean(payload?.resolved?.profileId),
	fn: (_, payload) => payload.resolved.profileId as string,
	target: selectPipelineProfileForEdit,
});

export const setChatActiveProfileRequested = createEvent<{ chatId: string; profileId: string | null }>();
export const setEntityActiveProfileRequested = createEvent<{ entityProfileId: string; profileId: string | null }>();
export const setGlobalActiveProfileRequested = createEvent<{ profileId: string | null }>();

export const setChatActiveProfileFx = createEffect(async (params: { chatId: string; profileId: string | null }) => {
	return setChatActivePipelineProfile(params);
});

export const setEntityActiveProfileFx = createEffect(async (params: { entityProfileId: string; profileId: string | null }) => {
	return setEntityProfileActivePipelineProfile(params);
});

export const setGlobalActiveProfileFx = createEffect(async (params: { profileId: string | null }) => {
	return setGlobalActivePipelineProfile(params);
});

sample({ clock: setChatActiveProfileRequested, target: setChatActiveProfileFx });
sample({ clock: setEntityActiveProfileRequested, target: setEntityActiveProfileFx });
sample({ clock: setGlobalActiveProfileRequested, target: setGlobalActiveProfileFx });

// Refresh resolved state after any update.
sample({
	clock: [setChatActiveProfileFx.doneData, setEntityActiveProfileFx.doneData, setGlobalActiveProfileFx.doneData],
	source: $chatActivePipelineProfile,
	filter: (state): state is ChatActivePipelineProfileResponse => Boolean(state?.chatId),
	fn: (state) => ({ chatId: state!.chatId }),
	target: loadChatActivePipelineProfileFx,
});

sample({
	clock: pipelineSseEnvelopeReceived,
	source: $pipelineRuntime,
	fn: (state, env) => {
		if (!env.type.startsWith('pipeline.run.')) return state;
		const data = env.data as any;

		const status: PipelineRunStatus | null =
			env.type === 'pipeline.run.started'
				? 'running'
				: env.type === 'pipeline.run.done'
					? 'done'
					: env.type === 'pipeline.run.aborted'
						? 'aborted'
						: env.type === 'pipeline.run.error'
							? 'error'
							: (data?.status as PipelineRunStatus | undefined) ?? state.status ?? null;

		const err = env.type === 'pipeline.run.error' ? (data?.error as any) : null;

		return {
			...state,
			chatId: typeof data?.chatId === 'string' ? data.chatId : state.chatId,
			branchId: typeof data?.branchId === 'string' ? data.branchId : state.branchId,
			runId: (typeof data?.runId === 'string' ? data.runId : typeof data?.pipelineRunId === 'string' ? data.pipelineRunId : state.runId) ?? null,
			pipelineId: typeof data?.pipelineId === 'string' ? data.pipelineId : state.pipelineId,
			pipelineName: typeof data?.pipelineName === 'string' ? data.pipelineName : state.pipelineName,
			trigger: typeof data?.trigger === 'string' ? data.trigger : state.trigger,
			status,
			stepRunId:
				typeof data?.stepRunId === 'string'
					? data.stepRunId
					: typeof data?.pipelineStepRunId === 'string'
						? data.pipelineStepRunId
						: state.stepRunId,
			stepType: typeof data?.stepType === 'string' ? data.stepType : state.stepType,
			generationId: typeof data?.generationId === 'string' ? data.generationId : state.generationId,
			activeProfileId: typeof data?.activeProfileId === 'string' ? data.activeProfileId : data?.activeProfileId === null ? null : state.activeProfileId,
			activeProfileVersion:
				typeof data?.activeProfileVersion === 'number'
					? data.activeProfileVersion
					: data?.activeProfileVersion === null
						? null
						: state.activeProfileVersion,
			profileSource: typeof data?.profileSource === 'string' ? data.profileSource : data?.profileSource === null ? null : state.profileSource,
			lastError:
				err && typeof err === 'object'
					? {
							code: typeof err.code === 'string' ? err.code : undefined,
							message: typeof err.message === 'string' ? err.message : undefined,
						}
					: env.type === 'pipeline.run.error'
						? { message: 'Pipeline error' }
						: state.lastError,
		};
	},
	target: $pipelineRuntime,
});

function normalizeRunStatus(v: unknown): PipelineRunStatus | null {
	return v === 'running' || v === 'done' || v === 'aborted' || v === 'error' ? v : null;
}

function normalizeGenerationStatus(v: unknown): 'streaming' | 'done' | 'aborted' | 'error' | null {
	return v === 'streaming' || v === 'done' || v === 'aborted' || v === 'error' ? v : null;
}

sample({
	clock: loadChatPipelineStateFx.doneData,
	source: $pipelineRuntime,
	fn: (state, payload) => {
		const runStatus = normalizeRunStatus(payload.run?.status);
		const genStatus = normalizeGenerationStatus(payload.generation?.status);

		const status: PipelineRunStatus | null =
			runStatus ??
			(genStatus === 'streaming'
				? 'running'
				: genStatus === 'done'
					? 'done'
					: genStatus === 'aborted'
						? 'aborted'
						: genStatus === 'error'
							? 'error'
							: state.status ?? null);

		return {
			...state,
			chatId: payload.chatId ?? state.chatId,
			branchId: payload.run?.branchId ?? payload.generation?.branchId ?? state.branchId,
			runId: payload.run?.id ?? payload.generation?.pipelineRunId ?? state.runId,
			trigger: payload.run?.trigger ?? state.trigger,
			status,
			stepRunId: payload.step?.id ?? payload.generation?.pipelineStepRunId ?? state.stepRunId,
			stepType: payload.step?.stepType ?? state.stepType,
			generationId: payload.generation?.id ?? state.generationId,
			lastError:
				payload.step?.error || payload.generation?.error
					? { message: payload.step?.error ?? payload.generation?.error ?? undefined }
					: state.lastError,
		};
	},
	target: $pipelineRuntime,
});

// Best-effort polling: if we had to recover state and it's still running,
// re-fetch until it reaches a terminal status (or user switches chat/branch).
sample({
	clock: loadChatPipelineStateFx.doneData,
	source: $pipelineRuntime,
	filter: (runtime) => runtime.status === 'running' && Boolean(runtime.chatId),
	fn: (runtime) => ({ chatId: runtime.chatId!, branchId: runtime.branchId ?? undefined }),
	target: schedulePipelineStatePollFx,
});

sample({
	clock: schedulePipelineStatePollFx.doneData,
	source: $pipelineRuntime,
	filter: (runtime, params) => runtime.chatId === params.chatId && runtime.status === 'running',
	fn: (_, params) => params,
	target: refreshPipelineStateRequested,
});

