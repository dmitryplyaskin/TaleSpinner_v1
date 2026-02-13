import { describe, expect, test } from 'vitest';

import {
	ragEmbeddingsBodySchema,
	ragProviderIdSchema,
	ragProviderParamsSchema,
	ragRuntimePatchBodySchema,
	ragTokensQuerySchema,
} from './rag.api';

describe('rag route schemas', () => {
	test('provider id schema allows only openrouter and ollama', () => {
		expect(ragProviderIdSchema.safeParse('openrouter').success).toBe(true);
		expect(ragProviderIdSchema.safeParse('ollama').success).toBe(true);
		expect(ragProviderIdSchema.safeParse('openai_compatible').success).toBe(false);
	});

	test('runtime patch schema accepts nullable token/model and optional fields', () => {
		const parsed = ragRuntimePatchBodySchema.safeParse({
			activeProviderId: 'openrouter',
			activeTokenId: null,
			activeModel: null,
		});
		expect(parsed.success).toBe(true);
	});

	test('provider params and tokens query schema validate provider id', () => {
		expect(ragProviderParamsSchema.safeParse({ providerId: 'ollama' }).success).toBe(true);
		expect(ragProviderParamsSchema.safeParse({ providerId: 'bad' }).success).toBe(false);
		expect(ragTokensQuerySchema.safeParse({ providerId: 'openrouter' }).success).toBe(true);
		expect(ragTokensQuerySchema.safeParse({ providerId: 'bad' }).success).toBe(false);
	});

	test('embeddings schema accepts non-empty string or non-empty array of non-empty strings', () => {
		expect(ragEmbeddingsBodySchema.safeParse({ input: 'hello' }).success).toBe(true);
		expect(ragEmbeddingsBodySchema.safeParse({ input: ['one', 'two'] }).success).toBe(true);
		expect(ragEmbeddingsBodySchema.safeParse({ input: '' }).success).toBe(false);
		expect(ragEmbeddingsBodySchema.safeParse({ input: [] }).success).toBe(false);
		expect(ragEmbeddingsBodySchema.safeParse({ input: ['ok', ''] }).success).toBe(false);
	});
});
