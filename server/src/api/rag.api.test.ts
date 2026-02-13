import { describe, expect, test } from 'vitest';

import {
	ragEmbeddingsBodySchema,
	ragModelsQuerySchema,
	ragPresetCreateBodySchema,
	ragPresetSettingsPatchBodySchema,
	ragPresetUpdateBodySchema,
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
		expect(ragModelsQuerySchema.safeParse({ providerId: 'openrouter' }).success).toBe(true);
		expect(ragModelsQuerySchema.safeParse({ providerId: 'openrouter', tokenId: 'tok-1' }).success).toBe(true);
		expect(ragModelsQuerySchema.safeParse({ providerId: 'bad' }).success).toBe(false);
	});

	test('embeddings schema accepts non-empty string or non-empty array of non-empty strings', () => {
		expect(ragEmbeddingsBodySchema.safeParse({ input: 'hello' }).success).toBe(true);
		expect(ragEmbeddingsBodySchema.safeParse({ input: ['one', 'two'] }).success).toBe(true);
		expect(ragEmbeddingsBodySchema.safeParse({ input: '' }).success).toBe(false);
		expect(ragEmbeddingsBodySchema.safeParse({ input: [] }).success).toBe(false);
		expect(ragEmbeddingsBodySchema.safeParse({ input: ['ok', ''] }).success).toBe(false);
	});

	test('preset create/update schemas validate payload', () => {
		const validPreset = {
			id: 'preset-1',
			name: 'Preset 1',
			payload: {
				activeProviderId: 'openrouter',
				activeTokenId: 'tok-1',
				activeModel: 'openai/text-embedding-3-small',
				providerConfigsById: {
					openrouter: { dimensions: 1536, encodingFormat: 'float' },
				},
			},
			createdAt: new Date().toISOString(),
			updatedAt: new Date().toISOString(),
		};

		expect(ragPresetCreateBodySchema.safeParse(validPreset).success).toBe(true);
		expect(ragPresetUpdateBodySchema.safeParse(validPreset).success).toBe(true);
		expect(ragPresetCreateBodySchema.safeParse({ ...validPreset, id: '' }).success).toBe(false);
		expect(
			ragPresetCreateBodySchema.safeParse({
				...validPreset,
				payload: { ...validPreset.payload, activeProviderId: 'bad' },
			}).success,
		).toBe(false);
	});

	test('preset settings patch schema accepts selectedId and legacy shape', () => {
		expect(ragPresetSettingsPatchBodySchema.safeParse({ selectedId: 'preset-1' }).success).toBe(true);
		expect(ragPresetSettingsPatchBodySchema.safeParse({ selectedId: null }).success).toBe(true);
		expect(ragPresetSettingsPatchBodySchema.safeParse({ selectedId: 'preset-1', enabled: true }).success).toBe(true);
		expect(ragPresetSettingsPatchBodySchema.safeParse({ selectedId: '' }).success).toBe(false);
	});
});
