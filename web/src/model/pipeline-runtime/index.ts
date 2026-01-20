import { createEffect, createEvent, createStore, sample } from 'effector';

import type { SseEnvelope } from '../../api/chat-core';
import {
	getChatActivePipelineProfile,
	getChatPipelineDebug,
	listPipelineProfiles,
	setChatActivePipelineProfile,
	setEntityProfileActivePipelineProfile,
	setGlobalActivePipelineProfile,
	type ChatActivePipelineProfileResponse,
	type ChatPipelineDebugDto,
	type PipelineProfileDto,
} from '../../api/chat-core';

export type PipelineRunStatus = 'running' | 'done' | 'aborted' | 'error';

export type PipelineRuntimeState = {
	chatId: string | null;
	branchId: string | null;
	runId: string | null;
	pipelineId: string | null;
	pipelineName: string | null;
	trigger: string | null;
	status: PipelineRunStatus | null;
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

// ---- Active profile UI helpers

export const loadPipelineProfilesFx = createEffect(async (): Promise<PipelineProfileDto[]> => {
	return listPipelineProfiles();
});

export const $pipelineProfiles = createStore<PipelineProfileDto[]>([]).on(loadPipelineProfilesFx.doneData, (_, p) => p);

export const loadChatActivePipelineProfileFx = createEffect(async (params: { chatId: string }) => {
	return getChatActivePipelineProfile(params.chatId);
});

export const $chatActivePipelineProfile = createStore<ChatActivePipelineProfileResponse | null>(null).on(
	loadChatActivePipelineProfileFx.doneData,
	(_, data) => data,
);

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

