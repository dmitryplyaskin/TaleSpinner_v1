import { describe, expect, test } from 'vitest';

import { createRagProviderDraft, normalizeRagProviderConfig } from './rag-provider-draft';

describe('RAG provider draft', () => {
	test('normalizes Ollama defaults without overwriting saved values', () => {
		expect(normalizeRagProviderConfig('ollama', { baseUrl: 'http://127.0.0.1:11434', truncate: false })).toEqual({
			baseUrl: 'http://127.0.0.1:11434',
			defaultModel: 'nomic-embed-text',
			keepAlive: '5m',
			truncate: false,
		});
	});

	test('uses active runtime values for the selected provider', () => {
		const draft = createRagProviderDraft('openrouter', {}, {
			activeProviderId: 'openrouter',
			activeTokenId: 'token-1',
			activeModel: 'openai/text-embedding-3-small',
			activeTokenHint: null,
		});

		expect(draft.tokenId).toBe('token-1');
		expect(draft.modelId).toBe('openai/text-embedding-3-small');
	});

	test('does not carry an OpenRouter token into an Ollama draft', () => {
		const draft = createRagProviderDraft('ollama', undefined, {
			activeProviderId: 'openrouter',
			activeTokenId: 'token-1',
			activeModel: 'openai/text-embedding-3-small',
			activeTokenHint: null,
		});

		expect(draft.tokenId).toBeNull();
		expect(draft.modelId).toBe('nomic-embed-text');
	});
});
