import { describe, expect, test } from 'vitest';

import { createProviderDraft } from './llm-provider-draft';

describe('llm-provider-draft', () => {
	test('restores the saved token, model, and config for each provider', () => {
		const openRouter = createProviderDraft(
			'openrouter',
			{ openRouterRouting: { strategy: 'price', allowFallbacks: false } },
			{ lastTokenId: 'or-token', lastModel: 'google/gemini' },
		);
		const compatible = createProviderDraft(
			'openai_compatible',
			{ baseUrl: 'http://localhost:1234/v1' },
			{ lastTokenId: 'local-token', lastModel: 'local-model' },
		);

		expect(openRouter).toMatchObject({ tokenId: 'or-token', modelId: 'google/gemini' });
		expect(openRouter.config.openRouterRouting?.strategy).toBe('price');
		expect(compatible).toMatchObject({ tokenId: 'local-token', modelId: 'local-model' });
		expect(compatible.config.baseUrl).toBe('http://localhost:1234/v1');
	});
});
