import { createStore } from 'effector';

import { handleSseEnvelope } from '../chat-entry-parts';

import type { SseEnvelope } from '../../api/chat-core';

const VALUE_PREVIEW_MAX_CHARS = 200;

export type TraceOperationStatus = 'running' | 'done' | 'skipped' | 'error' | 'aborted';

export type TraceRunStatus = 'running' | 'done' | 'failed' | 'aborted' | 'error';

export type TraceEffect = {
	type: string;
	mode: string | null;
	role: string | null;
	depthFromEnd: number | null;
	artifactId: string | null;
	valuePreview: string;
	valueChars: number;
};

export type TraceCommit = {
	effectType: string;
	status: 'applied' | 'skipped' | 'error';
	message: string | null;
};

export type TraceActivationSnapshot = {
	everyNTurns: number | null;
	everyNContextTokens: number | null;
	turnsCounter: number;
	tokensCounter: number;
};

export type TraceGuardSnapshot = {
	sourceOpId: string;
	outputKey: string;
	operator: string;
	actual: boolean | null;
};

export type TraceOperation = {
	key: string;
	opId: string;
	name: string;
	hook: string;
	status: TraceOperationStatus;
	skipReason: string | null;
	activation: TraceActivationSnapshot | null;
	guard: TraceGuardSnapshot | null;
	blockedByOpIds: string[];
	errorMessage: string | null;
	debugSummary: string | null;
	effects: TraceEffect[];
	commits: TraceCommit[];
	startedAtTs: number | null;
	finishedAtTs: number | null;
};

export type RunTrace = {
	runId: string;
	generationId: string | null;
	chatId: string | null;
	branchId: string | null;
	trigger: string | null;
	status: TraceRunStatus;
	failedType: string | null;
	errorMessage: string | null;
	startedAtTs: number;
	finishedAtTs: number | null;
	mainLlm: {
		providerId: string | null;
		model: string | null;
		status: string | null;
	} | null;
	operations: TraceOperation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getString(data: Record<string, unknown>, key: string): string | null {
	const value = data[key];
	return typeof value === 'string' ? value : null;
}

function getNumber(data: Record<string, unknown>, key: string): number | null {
	const value = data[key];
	return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toValuePreview(value: unknown): { preview: string; chars: number } {
	const text = typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value) ?? '';
	return {
		preview: text.length > VALUE_PREVIEW_MAX_CHARS ? `${text.slice(0, VALUE_PREVIEW_MAX_CHARS)}…` : text,
		chars: text.length,
	};
}

function readTraceEffect(raw: unknown): TraceEffect | null {
	if (!isRecord(raw)) return null;
	const type = getString(raw, 'type');
	if (!type) return null;
	const value = 'value' in raw ? raw.value : 'payload' in raw ? raw.payload : 'text' in raw ? raw.text : undefined;
	const { preview, chars } = toValuePreview(value);
	const target = getString(raw, 'target');
	return {
		type,
		mode: getString(raw, 'mode'),
		role: getString(raw, 'role') ?? target,
		depthFromEnd: getNumber(raw, 'depthFromEnd'),
		artifactId: getString(raw, 'artifactId'),
		valuePreview: preview,
		valueChars: chars,
	};
}

function readActivation(raw: unknown): TraceActivationSnapshot | null {
	if (!isRecord(raw)) return null;
	return {
		everyNTurns: getNumber(raw, 'everyNTurns'),
		everyNContextTokens: getNumber(raw, 'everyNContextTokens'),
		turnsCounter: getNumber(raw, 'turnsCounter') ?? 0,
		tokensCounter: getNumber(raw, 'tokensCounter') ?? 0,
	};
}

function readGuard(raw: unknown): TraceGuardSnapshot | null {
	if (!isRecord(raw)) return null;
	const sourceOpId = getString(raw, 'sourceOpId');
	const outputKey = getString(raw, 'outputKey');
	const operator = getString(raw, 'operator');
	if (!sourceOpId || !outputKey || !operator) return null;
	const actual = raw.actual;
	return {
		sourceOpId,
		outputKey,
		operator,
		actual: typeof actual === 'boolean' ? actual : null,
	};
}

function readBlockedByOpIds(raw: unknown): string[] {
	if (!isRecord(raw)) return [];
	const value = raw.blockedByOpIds;
	if (!Array.isArray(value)) return [];
	return value.filter((item): item is string => typeof item === 'string');
}

function operationKey(hook: string, opId: string): string {
	return `${hook}:${opId}`;
}

function makeOperation(params: { hook: string; opId: string; name: string }): TraceOperation {
	return {
		key: operationKey(params.hook, params.opId),
		opId: params.opId,
		name: params.name,
		hook: params.hook,
		status: 'running',
		skipReason: null,
		activation: null,
		guard: null,
		blockedByOpIds: [],
		errorMessage: null,
		debugSummary: null,
		effects: [],
		commits: [],
		startedAtTs: null,
		finishedAtTs: null,
	};
}

function upsertOperation(
	trace: RunTrace,
	params: { hook: string; opId: string; name: string },
	update: (op: TraceOperation) => TraceOperation,
): RunTrace {
	const key = operationKey(params.hook, params.opId);
	const existingIndex = trace.operations.findIndex((op) => op.key === key);
	if (existingIndex < 0) {
		return { ...trace, operations: [...trace.operations, update(makeOperation(params))] };
	}
	const operations = trace.operations.map((op, index) => (index === existingIndex ? update(op) : op));
	return { ...trace, operations };
}

export function reduceRunTrace(current: RunTrace | null, env: SseEnvelope): RunTrace | null {
	const data = isRecord(env.data) ? env.data : null;
	if (!data) return current;
	const ts = typeof env.ts === 'number' ? env.ts : Date.now();

	if (env.type === 'run.started') {
		const runId = getString(data, 'runId');
		if (!runId) return current;
		return {
			runId,
			generationId: getString(data, 'generationId'),
			chatId: getString(data, 'chatId'),
			branchId: getString(data, 'branchId'),
			trigger: getString(data, 'trigger'),
			status: 'running',
			failedType: null,
			errorMessage: null,
			startedAtTs: ts,
			finishedAtTs: null,
			mainLlm: null,
			operations: [],
		};
	}

	if (!current) return current;
	const runId = getString(data, 'runId');
	if (runId && runId !== current.runId) return current;

	if (env.type === 'operation.started') {
		const opId = getString(data, 'opId');
		const hook = getString(data, 'hook') ?? 'unknown';
		if (!opId) return current;
		const name = getString(data, 'name') ?? opId;
		return upsertOperation(current, { hook, opId, name }, (op) => ({
			...op,
			name,
			status: 'running',
			startedAtTs: op.startedAtTs ?? ts,
		}));
	}

	if (env.type === 'operation.finished') {
		const opId = getString(data, 'opId');
		const hook = getString(data, 'hook') ?? 'unknown';
		if (!opId) return current;
		const name = getString(data, 'name') ?? opId;
		const statusRaw = getString(data, 'status');
		const status: TraceOperationStatus =
			statusRaw === 'done' || statusRaw === 'skipped' || statusRaw === 'error' || statusRaw === 'aborted'
				? statusRaw
				: 'error';
		const skipDetails = isRecord(data.skipDetails) ? data.skipDetails : null;
		const error = isRecord(data.error) ? data.error : null;
		const result = isRecord(data.result) ? data.result : null;
		const effectsRaw = result && Array.isArray(result.effects) ? result.effects : [];
		const effects = effectsRaw
			.map((item) => readTraceEffect(item))
			.filter((item): item is TraceEffect => item !== null);

		return upsertOperation(current, { hook, opId, name }, (op) => ({
			...op,
			name,
			status,
			skipReason: getString(data, 'skipReason'),
			activation: skipDetails ? readActivation(skipDetails.activation) : null,
			guard: skipDetails ? readGuard(skipDetails.guard) : null,
			blockedByOpIds: readBlockedByOpIds(skipDetails),
			errorMessage: error ? getString(error, 'message') : null,
			debugSummary: result ? getString(result, 'debugSummary') : null,
			effects,
			finishedAtTs: ts,
		}));
	}

	if (
		env.type === 'commit.effect_applied' ||
		env.type === 'commit.effect_skipped' ||
		env.type === 'commit.effect_error'
	) {
		const opId = getString(data, 'opId');
		const hook = getString(data, 'hook') ?? 'unknown';
		const effectType = getString(data, 'effectType');
		if (!opId || !effectType) return current;
		const status: TraceCommit['status'] =
			env.type === 'commit.effect_applied' ? 'applied' : env.type === 'commit.effect_skipped' ? 'skipped' : 'error';
		return upsertOperation(current, { hook, opId, name: opId }, (op) => ({
			...op,
			commits: [...op.commits, { effectType, status, message: getString(data, 'message') }],
		}));
	}

	if (env.type === 'main_llm.started') {
		return {
			...current,
			mainLlm: {
				providerId: getString(data, 'providerId'),
				model: getString(data, 'model'),
				status: 'running',
			},
		};
	}

	if (env.type === 'main_llm.finished') {
		return {
			...current,
			mainLlm: {
				providerId: current.mainLlm?.providerId ?? null,
				model: current.mainLlm?.model ?? null,
				status: getString(data, 'status'),
			},
		};
	}

	if (env.type === 'run.finished') {
		const statusRaw = getString(data, 'status');
		const status: TraceRunStatus =
			statusRaw === 'done' || statusRaw === 'failed' || statusRaw === 'aborted' || statusRaw === 'error'
				? statusRaw
				: 'error';
		return {
			...current,
			status,
			failedType: getString(data, 'failedType'),
			errorMessage: getString(data, 'message'),
			finishedAtTs: ts,
			operations: current.operations.map((op) =>
				op.status === 'running' ? { ...op, status: 'aborted', finishedAtTs: op.finishedAtTs ?? ts } : op,
			),
		};
	}

	return current;
}

export const $lastRunTrace = createStore<RunTrace | null>(null).on(handleSseEnvelope, (state, env) =>
	reduceRunTrace(state, env),
);
