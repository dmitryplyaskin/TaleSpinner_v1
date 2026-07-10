import { describe, expect, it } from 'vitest';

import { reduceRunTrace, type RunTrace } from './index';

import type { SseEnvelope } from '../../api/chat-core';

function env(type: string, data: Record<string, unknown>, ts = 1000): SseEnvelope {
	return { id: 'evt', type, ts, data };
}

function startedTrace(): RunTrace | null {
	return reduceRunTrace(
		null,
		env('run.started', {
			runId: 'run-1',
			generationId: 'gen-1',
			chatId: 'chat-1',
			branchId: 'branch-1',
			trigger: 'generate',
		}),
	);
}

describe('reduceRunTrace', () => {
	it('starts a new trace on run.started and resets the previous one', () => {
		const first = startedTrace();
		expect(first?.runId).toBe('run-1');
		expect(first?.status).toBe('running');
		expect(first?.operations).toEqual([]);

		const second = reduceRunTrace(first, env('run.started', { runId: 'run-2', trigger: 'regenerate' }, 2000));
		expect(second?.runId).toBe('run-2');
		expect(second?.trigger).toBe('regenerate');
		expect(second?.operations).toEqual([]);
	});

	it('ignores events before any run.started and events from another run', () => {
		expect(reduceRunTrace(null, env('operation.started', { runId: 'run-1', opId: 'op-1' }))).toBeNull();

		const trace = startedTrace();
		const next = reduceRunTrace(trace, env('operation.started', { runId: 'run-other', opId: 'op-1', hook: 'before_main_llm' }));
		expect(next?.operations).toEqual([]);
	});

	it('collects started and finished operations with effects', () => {
		let trace = startedTrace();
		trace = reduceRunTrace(
			trace,
			env('operation.started', { runId: 'run-1', hook: 'before_main_llm', opId: 'op-1', name: 'Summary' }, 1100),
		);
		expect(trace?.operations[0]?.status).toBe('running');
		expect(trace?.operations[0]?.startedAtTs).toBe(1100);

		trace = reduceRunTrace(
			trace,
			env(
				'operation.finished',
				{
					runId: 'run-1',
					hook: 'before_main_llm',
					opId: 'op-1',
					name: 'Summary',
					status: 'done',
					result: {
						debugSummary: 'prompt.insert_at_depth:412',
						effects: [
							{
								type: 'artifact.upsert',
								opId: 'op-1',
								artifactId: 'story_summary',
								value: 'a'.repeat(300),
							},
							{
								type: 'prompt.insert_at_depth',
								opId: 'op-1',
								role: 'system',
								depthFromEnd: 4,
								payload: 'short text',
							},
						],
					},
				},
				1500,
			),
		);

		const op = trace?.operations[0];
		expect(op?.status).toBe('done');
		expect(op?.finishedAtTs).toBe(1500);
		expect(op?.effects).toHaveLength(2);
		expect(op?.effects[0]).toMatchObject({ type: 'artifact.upsert', artifactId: 'story_summary', valueChars: 300 });
		expect(op?.effects[0]?.valuePreview.length).toBeLessThanOrEqual(201);
		expect(op?.effects[1]).toMatchObject({ type: 'prompt.insert_at_depth', role: 'system', depthFromEnd: 4, valueChars: 10 });
	});

	it('records skipped operations that never started, with skip details', () => {
		let trace = startedTrace();
		trace = reduceRunTrace(
			trace,
			env('operation.finished', {
				runId: 'run-1',
				hook: 'before_main_llm',
				opId: 'op-2',
				name: 'Journal',
				status: 'skipped',
				skipReason: 'activation_not_reached',
				skipDetails: {
					activation: { everyNTurns: 3, turnsCounter: 1, tokensCounter: 0 },
				},
			}),
		);

		const op = trace?.operations[0];
		expect(op?.status).toBe('skipped');
		expect(op?.skipReason).toBe('activation_not_reached');
		expect(op?.activation).toMatchObject({ everyNTurns: 3, turnsCounter: 1 });

		trace = reduceRunTrace(
			trace,
			env('operation.finished', {
				runId: 'run-1',
				hook: 'before_main_llm',
				opId: 'op-3',
				name: 'Translate',
				status: 'skipped',
				skipReason: 'guard_not_matched',
				skipDetails: {
					guard: { sourceOpId: 'op-guard', outputKey: 'need_translate', operator: 'is_true', actual: false },
				},
			}),
		);
		expect(trace?.operations[1]?.guard).toMatchObject({ outputKey: 'need_translate', actual: false });
	});

	it('attaches commit results to the operation', () => {
		let trace = startedTrace();
		trace = reduceRunTrace(
			trace,
			env('operation.finished', {
				runId: 'run-1',
				hook: 'before_main_llm',
				opId: 'op-1',
				name: 'Summary',
				status: 'done',
				result: { effects: [] },
			}),
		);
		trace = reduceRunTrace(
			trace,
			env('commit.effect_applied', { runId: 'run-1', hook: 'before_main_llm', opId: 'op-1', effectType: 'artifact.upsert' }),
		);
		trace = reduceRunTrace(
			trace,
			env('commit.effect_error', {
				runId: 'run-1',
				hook: 'before_main_llm',
				opId: 'op-1',
				effectType: 'prompt.system_update',
				message: 'boom',
			}),
		);

		expect(trace?.operations[0]?.commits).toEqual([
			{ effectType: 'artifact.upsert', status: 'applied', message: null },
			{ effectType: 'prompt.system_update', status: 'error', message: 'boom' },
		]);
	});

	it('tracks main llm and finalizes the run, aborting stuck operations', () => {
		let trace = startedTrace();
		trace = reduceRunTrace(trace, env('main_llm.started', { runId: 'run-1', providerId: 'openrouter', model: 'x' }));
		trace = reduceRunTrace(
			trace,
			env('operation.started', { runId: 'run-1', hook: 'after_main_llm', opId: 'op-9', name: 'Post' }),
		);
		trace = reduceRunTrace(trace, env('main_llm.finished', { runId: 'run-1', status: 'done' }));
		trace = reduceRunTrace(trace, env('run.finished', { runId: 'run-1', status: 'done', failedType: null }, 9000));

		expect(trace?.mainLlm).toMatchObject({ providerId: 'openrouter', model: 'x', status: 'done' });
		expect(trace?.status).toBe('done');
		expect(trace?.finishedAtTs).toBe(9000);
		expect(trace?.operations[0]?.status).toBe('aborted');
	});
});
