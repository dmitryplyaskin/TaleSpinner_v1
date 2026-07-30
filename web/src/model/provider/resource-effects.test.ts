import { beforeEach, describe, expect, test, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	listTokens: vi.fn(),
}));

vi.mock('../../api/llm', () => ({
	listTokens: mocks.listTokens,
}));

import { ensureTokensFx, loadTokensFx } from './resource-effects';

beforeEach(() => {
	vi.clearAllMocks();
	mocks.listTokens.mockResolvedValue([]);
});

describe('LLM resource effects', () => {
	test('treats an empty token list as cached and refreshes only when forced', async () => {
		await expect(ensureTokensFx('openrouter')).resolves.toEqual({ providerId: 'openrouter', tokens: [] });
		await expect(ensureTokensFx('openrouter')).resolves.toEqual({ providerId: 'openrouter', tokens: [] });
		expect(mocks.listTokens).toHaveBeenCalledTimes(1);

		await expect(loadTokensFx('openrouter')).resolves.toEqual({ providerId: 'openrouter', tokens: [] });
		expect(mocks.listTokens).toHaveBeenCalledTimes(2);
	});
});
