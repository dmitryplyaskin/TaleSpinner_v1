import { describe, expect, it } from 'vitest';

import { readOperationFinishedFailure } from './operation-finished-failure';

describe('readOperationFinishedFailure', () => {
	it('returns actionable error details', () => {
		expect(
			readOperationFinishedFailure({
				status: 'error',
				opId: 'summarize',
				name: 'Summarize',
				hook: 'before_main_llm',
				error: { code: 'LLM_PROVIDER_ERROR', message: 'Provider request failed' },
			}),
		).toEqual({
			status: 'error',
			name: 'Summarize',
			hook: 'before_main_llm',
			errorMessage: 'Provider request failed',
		});
	});

	it('ignores successful events and tolerates missing abort details', () => {
		expect(readOperationFinishedFailure({ status: 'done', opId: 'ok' })).toBeNull();
		expect(readOperationFinishedFailure({ status: 'aborted', opId: 'cancelled' })).toEqual({
			status: 'aborted',
			name: 'cancelled',
			hook: null,
			errorMessage: null,
		});
	});
});
