import { describe, expect, test } from 'vitest';

import { applyAssistantCanonicalizationPatch } from './assistant-canonicalization';

import type { ChatEntryWithVariantDto } from '../../api/chat-entry-parts';

describe('applyAssistantCanonicalizationPatch', () => {
	test('replaces the streamed assistant main-part payload', () => {
		const entries = [
			{
				entry: { entryId: 'assistant-entry' },
				variant: {
					variantId: 'variant-1',
					entryId: 'assistant-entry',
					parts: [
						{ partId: 'reasoning-part', channel: 'reasoning', payload: 'thinking' },
						{ partId: 'assistant-main-part', channel: 'main', payload: 'raw answer' },
					],
				},
			} as ChatEntryWithVariantDto,
		];

		const updated = applyAssistantCanonicalizationPatch({
			entries,
			entryId: 'assistant-entry',
			partId: 'assistant-main-part',
			afterText: 'normalized answer',
		});

		expect(updated[0]?.variant?.parts?.find((part) => part.channel === 'main')?.payload).toBe(
			'normalized answer',
		);
		expect(updated[0]?.variant?.parts?.find((part) => part.channel === 'reasoning')?.payload).toBe(
			'thinking',
		);
	});
});
