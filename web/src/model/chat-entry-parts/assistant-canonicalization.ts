import type { ChatEntryWithVariantDto } from '../../api/chat-entry-parts';

export function applyAssistantCanonicalizationPatch(params: {
	entries: ChatEntryWithVariantDto[];
	entryId: string;
	partId: string;
	afterText: string;
}): ChatEntryWithVariantDto[] {
	const entryIndex = params.entries.findIndex((item) => item.entry.entryId === params.entryId);
	if (entryIndex < 0) return params.entries;
	const target = params.entries[entryIndex];
	if (!target?.variant) return params.entries;

	const parts = target.variant.parts ?? [];
	const partIndex = parts.findIndex((part) => part.partId === params.partId);
	if (partIndex < 0) return params.entries;
	const currentPart = parts[partIndex];
	if (!currentPart || currentPart.payload === params.afterText) return params.entries;

	const nextParts = [...parts];
	nextParts[partIndex] = { ...currentPart, payload: params.afterText };
	const nextEntries = [...params.entries];
	nextEntries[entryIndex] = {
		...target,
		variant: { ...target.variant, parts: nextParts },
	};
	return nextEntries;
}
