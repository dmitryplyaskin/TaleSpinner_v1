import { describe, expect, it } from 'vitest';

import { describeDestination, describeOperationSummary, resolveOpName, runStatusColor } from './run-trace-summary';

import type { TranslateFn } from './run-trace-summary';
import type { RunTrace, TraceEffect, TraceOperation } from '@model/operation-run-trace';

const t: TranslateFn = (key, params) => (params ? `${key} ${JSON.stringify(params)}` : key);

function makeOp(overrides: Partial<TraceOperation>): TraceOperation {
	return {
		key: 'before_main_llm:op-1',
		opId: 'op-1',
		name: 'Op',
		hook: 'before_main_llm',
		status: 'done',
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
		...overrides,
	};
}

function makeTrace(operations: TraceOperation[]): RunTrace {
	return {
		runId: 'run-1',
		generationId: null,
		chatId: null,
		branchId: null,
		trigger: 'generate',
		status: 'done',
		failedType: null,
		errorMessage: null,
		startedAtTs: 0,
		finishedAtTs: null,
		mainLlm: null,
		operations,
	};
}

function makeEffect(overrides: Partial<TraceEffect>): TraceEffect {
	return {
		type: 'artifact.upsert',
		mode: null,
		role: null,
		depthFromEnd: null,
		artifactId: null,
		valuePreview: '',
		valueChars: 0,
		...overrides,
	};
}

describe('describeDestination', () => {
	it('maps every effect type to its destination key', () => {
		expect(describeDestination(t, makeEffect({ type: 'prompt.system_update', mode: 'append' }))).toContain(
			'dest.systemPrompt',
		);
		expect(describeDestination(t, makeEffect({ type: 'prompt.append_after_last_user' }))).toContain(
			'dest.promptAfterUser',
		);
		expect(describeDestination(t, makeEffect({ type: 'prompt.insert_at_depth', depthFromEnd: 4 }))).toContain(
			'dest.promptDepth {"depth":4}',
		);
		expect(describeDestination(t, makeEffect({ type: 'turn.user.replace_text' }))).toContain('dest.rewriteUser');
		expect(describeDestination(t, makeEffect({ type: 'turn.assistant.replace_text' }))).toContain(
			'dest.rewriteAssistant',
		);
		expect(describeDestination(t, makeEffect({ type: 'ui.inline' }))).toContain('dest.uiCard');
		expect(describeDestination(t, makeEffect({ type: 'artifact.upsert', artifactId: 'world_state' }))).toContain(
			'dest.state {"tag":"world_state"}',
		);
	});
});

describe('describeOperationSummary', () => {
	it('done: shows chars and exposure destinations, falling back to the artifact', () => {
		const withExposure = makeOp({
			effects: [
				makeEffect({ type: 'artifact.upsert', artifactId: 'summary', valueChars: 412 }),
				makeEffect({ type: 'prompt.insert_at_depth', depthFromEnd: 4, valueChars: 412 }),
			],
		});
		const summary = describeOperationSummary(t, makeTrace([withExposure]), withExposure);
		expect(summary).toContain('chars {"count":412}');
		expect(summary).toContain('dest.promptDepth');
		expect(summary).not.toContain('dest.state');

		const artifactOnly = makeOp({
			effects: [makeEffect({ type: 'artifact.upsert', artifactId: 'guard_out', valueChars: 20 })],
		});
		expect(describeOperationSummary(t, makeTrace([artifactOnly]), artifactOnly)).toContain('dest.state');
	});

	it('skipped: activation by turns and by tokens', () => {
		const byTurns = makeOp({
			status: 'skipped',
			skipReason: 'activation_not_reached',
			activation: { everyNTurns: 3, everyNContextTokens: null, turnsCounter: 1, tokensCounter: 0 },
		});
		expect(describeOperationSummary(t, makeTrace([byTurns]), byTurns)).toContain(
			'skip.activationTurns {"current":1,"target":3}',
		);

		const byTokens = makeOp({
			status: 'skipped',
			skipReason: 'activation_not_reached',
			activation: { everyNTurns: null, everyNContextTokens: 4000, turnsCounter: 0, tokensCounter: 1500 },
		});
		expect(describeOperationSummary(t, makeTrace([byTokens]), byTokens)).toContain(
			'skip.activationTokens {"current":1500,"target":4000}',
		);
	});

	it('skipped: guard condition with resolved source name', () => {
		const guardOp = makeOp({ opId: 'op-guard', key: 'before_main_llm:op-guard', name: 'Гард перевода' });
		const skipped = makeOp({
			opId: 'op-translate',
			key: 'before_main_llm:op-translate',
			status: 'skipped',
			skipReason: 'guard_not_matched',
			guard: { sourceOpId: 'op-guard', outputKey: 'need_translate', operator: 'is_true', actual: false },
		});
		const summary = describeOperationSummary(t, makeTrace([guardOp, skipped]), skipped);
		expect(summary).toContain('skip.guard');
		expect(summary).toContain('"name":"Гард перевода"');
		expect(summary).toContain('"key":"need_translate"');
		expect(summary).toContain('"actual":"operationProfiles.runTrace.actualNo"');
	});

	it('skipped: dependency lists blocker names', () => {
		const dep = makeOp({ opId: 'op-a', key: 'before_main_llm:op-a', name: 'Источник' });
		const skipped = makeOp({
			opId: 'op-b',
			key: 'before_main_llm:op-b',
			status: 'skipped',
			skipReason: 'dependency_not_done',
			blockedByOpIds: ['op-a'],
		});
		expect(describeOperationSummary(t, makeTrace([dep, skipped]), skipped)).toContain('"names":"Источник"');
	});

	it('error: prefers the error message', () => {
		const op = makeOp({ status: 'error', errorMessage: 'boom' });
		expect(describeOperationSummary(t, makeTrace([op]), op)).toBe('boom');
	});
});

describe('helpers', () => {
	it('resolveOpName falls back to opId', () => {
		expect(resolveOpName(makeTrace([]), 'op-x')).toBe('op-x');
	});

	it('runStatusColor maps run status to badge colors', () => {
		expect(runStatusColor('done')).toBe('teal');
		expect(runStatusColor('running')).toBe('blue');
		expect(runStatusColor('aborted')).toBe('yellow');
		expect(runStatusColor('failed')).toBe('red');
		expect(runStatusColor('error')).toBe('red');
	});
});
