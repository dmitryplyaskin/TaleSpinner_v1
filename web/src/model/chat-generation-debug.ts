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

function isDebugEnabled(): boolean {
	return isAppDebugEnabled();
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
			// keep stats copy, duration computed in logger
		} as RunStats & { finishedAtTs?: number; durationMs?: number };
	}

	return null;
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
		return {
			...base,
			hook: getString(data, 'hook'),
			opId: getString(data, 'opId'),
			name: getString(data, 'name'),
			status: getString(data, 'status'),
			skipReason: getString(data, 'skipReason'),
			errorCode: error ? getString(error, 'code') : null,
			errorMessage: error ? getString(error, 'message') : null,
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

export function logChatGenerationSseEvent(params: {
	scope: 'chat-core' | 'entry-parts';
	envelope: SseEnvelopeLike;
}): void {
	if (!isDebugEnabled()) return;

	const type = typeof params.envelope.type === 'string' ? params.envelope.type : 'unknown';
	const data = isRecord(params.envelope.data) ? params.envelope.data : null;
	const ts = typeof params.envelope.ts === 'number' ? params.envelope.ts : Date.now();

	if (!announced) {
		console.warn(`[chat-gen-debug] enabled (scope=${params.scope}). Toggle in App settings -> Debug`);
		announced = true;
	}

	const summary = summarizeEvent(type, data);
	const label = `[chat-gen:${params.scope}] ${type}`;

	if (type === 'llm.stream.error' || type === 'commit.effect_error') {
		console.error(label, summary);
	} else {
		console.warn(label, summary);
	}

	const finishedStats = updateRunStats(type, data, ts);
	if (finishedStats && type === 'run.finished') {
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
