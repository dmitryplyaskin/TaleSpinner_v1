import { createEvent, createStore } from 'effector';

import { isAppDebugEnabled } from './app-debug';

type SseEnvelopeLike = {
	id?: string;
	type?: string;
	ts?: number;
	data?: unknown;
};

type RunStats = {
	runId: string;
	generationId: string | null;
	startedAtTs: number;
	phases: string[];
	operations: {
		started: number;
		done: number;
		skipped: number;
		error: number;
		aborted: number;
	};
	commits: {
		applied: number;
		skipped: number;
		error: number;
	};
	mainLlm: {
		deltaChunks: number;
		deltaChars: number;
		reasoningChunks: number;
		reasoningChars: number;
	};
};

export type ChatGenerationLogFilterId =
	| 'runLifecycle'
	| 'operationStarted'
	| 'operationFinished'
	| 'operationCommits'
	| 'mainLlmLifecycle'
	| 'streamText'
	| 'streamReasoning'
	| 'streamMeta'
	| 'streamDone'
	| 'streamErrors'
	| 'debugSnapshots'
	| 'templateDebug'
	| 'other';

export type ChatGenerationLogFilters = Record<ChatGenerationLogFilterId, boolean>;

export type ChatGenerationLogFilterDefinition = {
	id: ChatGenerationLogFilterId;
	labelKey: string;
	descriptionKey: string;
};

const CHAT_GENERATION_DEBUG_LOG_FILTERS_STORAGE_KEY = 'chat_generation_debug_log_filters_v1';

const CHAT_GENERATION_LOG_FILTER_IDS: ChatGenerationLogFilterId[] = [
	'runLifecycle',
	'operationStarted',
	'operationFinished',
	'operationCommits',
	'mainLlmLifecycle',
	'streamText',
	'streamReasoning',
	'streamMeta',
	'streamDone',
	'streamErrors',
	'debugSnapshots',
	'templateDebug',
	'other',
];

const CHAT_GENERATION_LOG_FILTER_ID_SET = new Set<ChatGenerationLogFilterId>(CHAT_GENERATION_LOG_FILTER_IDS);

const DEFAULT_CHAT_GENERATION_LOG_FILTERS: ChatGenerationLogFilters = {
	runLifecycle: true,
	operationStarted: true,
	operationFinished: true,
	operationCommits: true,
	mainLlmLifecycle: true,
	streamText: true,
	streamReasoning: true,
	streamMeta: true,
	streamDone: true,
	streamErrors: true,
	debugSnapshots: true,
	templateDebug: true,
	other: true,
};

const OPERATION_AND_SNAPSHOTS_PRESET: ChatGenerationLogFilters = {
	runLifecycle: true,
	operationStarted: false,
	operationFinished: true,
	operationCommits: false,
	mainLlmLifecycle: false,
	streamText: false,
	streamReasoning: false,
	streamMeta: false,
	streamDone: false,
	streamErrors: true,
	debugSnapshots: true,
	templateDebug: false,
	other: false,
};

export const CHAT_GENERATION_LOG_FILTER_DEFINITIONS: ChatGenerationLogFilterDefinition[] = [
	{
		id: 'runLifecycle',
		labelKey: 'appSettings.debug.logs.runLifecycle.label',
		descriptionKey: 'appSettings.debug.logs.runLifecycle.description',
	},
	{
		id: 'operationStarted',
		labelKey: 'appSettings.debug.logs.operationStarted.label',
		descriptionKey: 'appSettings.debug.logs.operationStarted.description',
	},
	{
		id: 'operationFinished',
		labelKey: 'appSettings.debug.logs.operationFinished.label',
		descriptionKey: 'appSettings.debug.logs.operationFinished.description',
	},
	{
		id: 'operationCommits',
		labelKey: 'appSettings.debug.logs.operationCommits.label',
		descriptionKey: 'appSettings.debug.logs.operationCommits.description',
	},
	{
		id: 'mainLlmLifecycle',
		labelKey: 'appSettings.debug.logs.mainLlmLifecycle.label',
		descriptionKey: 'appSettings.debug.logs.mainLlmLifecycle.description',
	},
	{
		id: 'streamText',
		labelKey: 'appSettings.debug.logs.streamText.label',
		descriptionKey: 'appSettings.debug.logs.streamText.description',
	},
	{
		id: 'streamReasoning',
		labelKey: 'appSettings.debug.logs.streamReasoning.label',
		descriptionKey: 'appSettings.debug.logs.streamReasoning.description',
	},
	{
		id: 'streamMeta',
		labelKey: 'appSettings.debug.logs.streamMeta.label',
		descriptionKey: 'appSettings.debug.logs.streamMeta.description',
	},
	{
		id: 'streamDone',
		labelKey: 'appSettings.debug.logs.streamDone.label',
		descriptionKey: 'appSettings.debug.logs.streamDone.description',
	},
	{
		id: 'streamErrors',
		labelKey: 'appSettings.debug.logs.streamErrors.label',
		descriptionKey: 'appSettings.debug.logs.streamErrors.description',
	},
	{
		id: 'debugSnapshots',
		labelKey: 'appSettings.debug.logs.debugSnapshots.label',
		descriptionKey: 'appSettings.debug.logs.debugSnapshots.description',
	},
	{
		id: 'templateDebug',
		labelKey: 'appSettings.debug.logs.templateDebug.label',
		descriptionKey: 'appSettings.debug.logs.templateDebug.description',
	},
	{
		id: 'other',
		labelKey: 'appSettings.debug.logs.other.label',
		descriptionKey: 'appSettings.debug.logs.other.description',
	},
];

const runStatsById = new Map<string, RunStats>();
let announced = false;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(data: Record<string, unknown> | null, key: string): string | null {
	if (!data) return null;
	const value = data[key];
	return typeof value === 'string' ? value : null;
}

function getNumber(data: Record<string, unknown> | null, key: string): number | null {
	if (!data) return null;
	const value = data[key];
	return typeof value === 'number' ? value : null;
}

function toPreview(value: unknown, max = 120): string {
	const text = typeof value === 'string' ? value : String(value ?? '');
	if (text.length <= max) return text;
	return `${text.slice(0, max)}...`;
}

function isFilterId(value: string): value is ChatGenerationLogFilterId {
	return CHAT_GENERATION_LOG_FILTER_ID_SET.has(value as ChatGenerationLogFilterId);
}

function allFilters(enabled: boolean): ChatGenerationLogFilters {
	return Object.fromEntries(CHAT_GENERATION_LOG_FILTER_IDS.map((id) => [id, enabled])) as ChatGenerationLogFilters;
}

function normalizeFilters(raw: unknown): ChatGenerationLogFilters {
	const fallback = { ...DEFAULT_CHAT_GENERATION_LOG_FILTERS };
	if (!isRecord(raw)) return fallback;

	const next = { ...fallback };
	for (const [key, value] of Object.entries(raw)) {
		if (!isFilterId(key)) continue;
		if (typeof value !== 'boolean') continue;
		next[key] = value;
	}
	return next;
}

function readInitialLogFilters(): ChatGenerationLogFilters {
	if (typeof window === 'undefined') return { ...DEFAULT_CHAT_GENERATION_LOG_FILTERS };
	try {
		const raw = window.localStorage.getItem(CHAT_GENERATION_DEBUG_LOG_FILTERS_STORAGE_KEY);
		if (!raw) return { ...DEFAULT_CHAT_GENERATION_LOG_FILTERS };
		return normalizeFilters(JSON.parse(raw));
	} catch {
		return { ...DEFAULT_CHAT_GENERATION_LOG_FILTERS };
	}
}

function persistLogFilters(value: ChatGenerationLogFilters): void {
	if (typeof window === 'undefined') return;
	try {
		window.localStorage.setItem(CHAT_GENERATION_DEBUG_LOG_FILTERS_STORAGE_KEY, JSON.stringify(value));
	} catch {
		// ignore storage access errors
	}
}

function isDebugEnabled(): boolean {
	return isAppDebugEnabled();
}

function getFilterIdForEventType(type: string): ChatGenerationLogFilterId {
	if (type === 'run.started' || type === 'run.phase_changed' || type === 'run.finished' || type === 'run.summary') {
		return 'runLifecycle';
	}
	if (type === 'operation.started') return 'operationStarted';
	if (type === 'operation.finished') return 'operationFinished';
	if (type === 'commit.effect_applied' || type === 'commit.effect_skipped' || type === 'commit.effect_error') {
		return 'operationCommits';
	}
	if (type === 'main_llm.started' || type === 'main_llm.finished') return 'mainLlmLifecycle';
	if (type === 'llm.stream.delta' || type === 'main_llm.delta') return 'streamText';
	if (type === 'llm.stream.reasoning_delta' || type === 'main_llm.reasoning_delta') return 'streamReasoning';
	if (type === 'llm.stream.meta') return 'streamMeta';
	if (type === 'llm.stream.done') return 'streamDone';
	if (type === 'llm.stream.error') return 'streamErrors';
	if (type === 'run.debug.state_snapshot' || type === 'run.debug.main_llm_input') return 'debugSnapshots';
	if (type === 'operation.debug.template') return 'templateDebug';
	return 'other';
}

function ensureRunStats(runId: string, generationId: string | null, ts: number): RunStats {
	const existing = runStatsById.get(runId);
	if (existing) {
		if (generationId && !existing.generationId) existing.generationId = generationId;
		return existing;
	}

	const created: RunStats = {
		runId,
		generationId,
		startedAtTs: ts,
		phases: [],
		operations: {
			started: 0,
			done: 0,
			skipped: 0,
			error: 0,
			aborted: 0,
		},
		commits: {
			applied: 0,
			skipped: 0,
			error: 0,
		},
		mainLlm: {
			deltaChunks: 0,
			deltaChars: 0,
			reasoningChunks: 0,
			reasoningChars: 0,
		},
	};
	runStatsById.set(runId, created);
	return created;
}

function updateRunStats(type: string, data: Record<string, unknown> | null, ts: number): RunStats | null {
	const runId = getString(data, 'runId');
	const generationId = getString(data, 'generationId');

	if (!runId && type !== 'run.started') return null;
	const effectiveRunId = runId ?? generationId;
	if (!effectiveRunId) return null;

	const stats = ensureRunStats(effectiveRunId, generationId, ts);

	if (type === 'run.phase_changed') {
		const phase = getString(data, 'phase');
		if (phase) stats.phases.push(phase);
	}

	if (type === 'operation.started') {
		stats.operations.started += 1;
	}

	if (type === 'operation.finished') {
		const status = getString(data, 'status');
		if (status === 'done') stats.operations.done += 1;
		if (status === 'skipped') stats.operations.skipped += 1;
		if (status === 'error') stats.operations.error += 1;
		if (status === 'aborted') stats.operations.aborted += 1;
	}

	if (type === 'commit.effect_applied') stats.commits.applied += 1;
	if (type === 'commit.effect_skipped') stats.commits.skipped += 1;
	if (type === 'commit.effect_error') stats.commits.error += 1;

	if (type === 'main_llm.delta') {
		const chunk = getString(data, 'content') ?? '';
		stats.mainLlm.deltaChunks += 1;
		stats.mainLlm.deltaChars += chunk.length;
	}

	if (type === 'main_llm.reasoning_delta' || type === 'llm.stream.reasoning_delta') {
		const chunk = getString(data, 'content') ?? '';
		stats.mainLlm.reasoningChunks += 1;
		stats.mainLlm.reasoningChars += chunk.length;
	}

	if (type === 'run.finished') {
		runStatsById.delete(effectiveRunId);
		return {
			...stats,
			phases: [...stats.phases],
			operations: { ...stats.operations },
			commits: { ...stats.commits },
			mainLlm: { ...stats.mainLlm },
			startedAtTs: stats.startedAtTs,
		};
	}

	return null;
}

function summarizeEffect(effect: Record<string, unknown>): Record<string, unknown> {
	const type = getString(effect, 'type');
	const preview: Record<string, unknown> = {
		type,
		opId: getString(effect, 'opId'),
	};

	if (type === 'artifact.upsert') {
		preview.tag = getString(effect, 'tag');
		preview.valuePreview = toPreview(effect.value, 100);
		return preview;
	}

	if (type === 'prompt.system_update' || type === 'prompt.append_after_last_user' || type === 'prompt.insert_at_depth') {
		preview.payloadPreview = toPreview(effect.payload, 100);
		preview.role = getString(effect, 'role');
		return preview;
	}

	if (type === 'turn.user.replace_text' || type === 'turn.assistant.replace_text') {
		preview.textPreview = toPreview(effect.text, 100);
		return preview;
	}

	return preview;
}

function summarizeEvent(type: string, data: Record<string, unknown> | null): Record<string, unknown> {
	const base = {
		runId: getString(data, 'runId'),
		seq: getNumber(data, 'seq'),
		generationId: getString(data, 'generationId'),
	};

	if (type.startsWith('run.debug.') || type.startsWith('operation.debug.')) {
		return { ...base, ...(data ?? {}) };
	}

	if (type === 'llm.stream.meta') {
		return {
			...base,
			chatId: getString(data, 'chatId'),
			branchId: getString(data, 'branchId'),
			assistantMessageId: getString(data, 'assistantMessageId'),
			assistantEntryId: getString(data, 'assistantEntryId'),
			assistantVariantId: getString(data, 'assistantVariantId'),
			assistantMainPartId: getString(data, 'assistantMainPartId'),
			userMessageId: getString(data, 'userMessageId'),
			userEntryId: getString(data, 'userEntryId'),
		};
	}

	if (type === 'llm.stream.delta' || type === 'main_llm.delta' || type === 'llm.stream.reasoning_delta' || type === 'main_llm.reasoning_delta') {
		const content = getString(data, 'content') ?? '';
		return {
			...base,
			chunkChars: content.length,
			chunkPreview: toPreview(content, 80),
		};
	}

	if (type === 'run.phase_changed') return { ...base, phase: getString(data, 'phase') };
	if (type === 'run.started') return { ...base, trigger: getString(data, 'trigger') };

	if (type === 'operation.started') {
		return {
			...base,
			hook: getString(data, 'hook'),
			opId: getString(data, 'opId'),
			name: getString(data, 'name'),
		};
	}

	if (type === 'operation.finished') {
		const error = data && isRecord(data.error) ? data.error : null;
		const result = data && isRecord(data.result) ? data.result : null;
		const effects = result && Array.isArray(result.effects)
			? result.effects.filter((effect): effect is Record<string, unknown> => isRecord(effect))
			: [];
		return {
			...base,
			hook: getString(data, 'hook'),
			opId: getString(data, 'opId'),
			name: getString(data, 'name'),
			status: getString(data, 'status'),
			skipReason: getString(data, 'skipReason'),
			errorCode: error ? getString(error, 'code') : null,
			errorMessage: error ? getString(error, 'message') : null,
			resultDebugSummary: result ? getString(result, 'debugSummary') : null,
			resultEffectsCount: effects.length,
			resultEffects: effects.map((effect) => summarizeEffect(effect)),
		};
	}

	if (
		type === 'commit.effect_applied' ||
		type === 'commit.effect_skipped' ||
		type === 'commit.effect_error'
	) {
		return {
			...base,
			hook: getString(data, 'hook'),
			opId: getString(data, 'opId'),
			effectType: getString(data, 'effectType'),
			message: getString(data, 'message'),
		};
	}

	if (type === 'main_llm.started') {
		return {
			...base,
			providerId: getString(data, 'providerId'),
			model: getString(data, 'model'),
		};
	}

	if (type === 'main_llm.finished') {
		return {
			...base,
			status: getString(data, 'status'),
			message: getString(data, 'message'),
		};
	}

	if (type === 'run.finished' || type === 'llm.stream.done') {
		return {
			...base,
			status: getString(data, 'status'),
			failedType: getString(data, 'failedType'),
			message: getString(data, 'message'),
		};
	}

	if (type === 'llm.stream.error') {
		return {
			...base,
			code: getString(data, 'code'),
			message: getString(data, 'message'),
		};
	}

	return { ...base, data };
}

export const setChatGenerationLogFilter = createEvent<{ id: ChatGenerationLogFilterId; enabled: boolean }>();
export const setChatGenerationLogFilters = createEvent<Partial<ChatGenerationLogFilters>>();
export const resetChatGenerationLogFilters = createEvent();
export const enableAllChatGenerationLogFilters = createEvent();
export const disableAllChatGenerationLogFilters = createEvent();
export const applyOperationAndSnapshotsLogPreset = createEvent();

export const $chatGenerationLogFilters = createStore<ChatGenerationLogFilters>(readInitialLogFilters())
	.on(setChatGenerationLogFilter, (state, { id, enabled }) => ({ ...state, [id]: enabled }))
	.on(setChatGenerationLogFilters, (state, patch) => {
		const next = { ...state };
		for (const [key, value] of Object.entries(patch)) {
			if (!isFilterId(key)) continue;
			if (typeof value !== 'boolean') continue;
			next[key] = value;
		}
		return next;
	})
	.on(resetChatGenerationLogFilters, () => ({ ...DEFAULT_CHAT_GENERATION_LOG_FILTERS }))
	.on(enableAllChatGenerationLogFilters, () => allFilters(true))
	.on(disableAllChatGenerationLogFilters, () => allFilters(false))
	.on(applyOperationAndSnapshotsLogPreset, () => ({ ...OPERATION_AND_SNAPSHOTS_PRESET }));

$chatGenerationLogFilters.watch((filters) => {
	persistLogFilters(filters);
});

export function shouldLogChatGenerationEvent(type: string): boolean {
	return Boolean($chatGenerationLogFilters.getState()[getFilterIdForEventType(type)]);
}

export function logChatGenerationSseEvent(params: {
	scope: 'chat-core' | 'entry-parts';
	envelope: SseEnvelopeLike;
}): void {
	if (!isDebugEnabled()) return;

	const type = typeof params.envelope.type === 'string' ? params.envelope.type : 'unknown';
	const data = isRecord(params.envelope.data) ? params.envelope.data : null;
	const ts = typeof params.envelope.ts === 'number' ? params.envelope.ts : Date.now();

	const finishedStats = updateRunStats(type, data, ts);

	if (!announced) {
		console.warn(`[chat-gen-debug] enabled (scope=${params.scope}). Toggle in App settings -> Debug`);
		announced = true;
	}

	if (shouldLogChatGenerationEvent(type)) {
		const summary = summarizeEvent(type, data);
		const label = `[chat-gen:${params.scope}] ${type}`;
		if (type === 'llm.stream.error' || type === 'commit.effect_error') {
			console.error(label, summary);
		} else {
			console.warn(label, summary);
		}
	}

	if (finishedStats && type === 'run.finished' && shouldLogChatGenerationEvent('run.summary')) {
		console.warn(`[chat-gen:${params.scope}] run.summary`, {
			runId: finishedStats.runId,
			generationId: finishedStats.generationId,
			durationMs: Math.max(0, ts - finishedStats.startedAtTs),
			phases: finishedStats.phases,
			operations: finishedStats.operations,
			commits: finishedStats.commits,
			mainLlm: finishedStats.mainLlm,
			status: getString(data, 'status'),
			failedType: getString(data, 'failedType'),
		});
	}
}
