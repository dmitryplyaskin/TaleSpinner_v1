import { describe, expect, test } from 'vitest';

import { filterModels, formatContextLength, formatPricePerMillion, getModelMetadata } from './llm-model-utils';

import type { LlmModel } from '@shared/types/llm';

const models: LlmModel[] = [
	{
		id: 'google/gemini:free',
		name: 'Gemini Vision',
		contextLength: 1_048_576,
		pricing: { prompt: '0.0000005', completion: '0.000002' },
		inputModalities: ['text', 'image'],
		supportedParameters: ['reasoning', 'tools'],
	},
	{ id: 'anthropic/claude', name: 'Claude' },
];

describe('llm-model-utils', () => {
	test('filters by text and capabilities', () => {
		expect(filterModels(models, 'gemini', 'all')).toHaveLength(1);
		expect(filterModels(models, '', 'free')).toEqual([models[0]]);
		expect(filterModels(models, '', 'vision')).toEqual([models[0]]);
		expect(filterModels(models, '', 'tools')).toEqual([models[0]]);
	});

	test('formats compact model metadata', () => {
		expect(formatContextLength(1_048_576)).toBe('1M');
		expect(formatPricePerMillion('0.0000005')).toBe('$0.50');
		expect(getModelMetadata(models[0])).toEqual({
			context: '1M',
			inputPrice: '$0.50',
			outputPrice: '$2.00',
			vision: true,
			reasoning: true,
			tools: true,
		});
	});
});
