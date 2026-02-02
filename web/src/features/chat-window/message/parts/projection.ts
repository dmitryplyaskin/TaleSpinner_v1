import type { Entry, Part, Variant } from '@shared/types/chat-entry-parts';

export type UiProjectionOptions = {
	currentTurn: number;
	debugEnabled: boolean;
};

function isTtlExpired(part: Part, currentTurn: number): boolean {
	if (part.lifespan === 'infinite') return false;
	return currentTurn - part.createdTurn >= part.lifespan.turns;
}

function compareParts(a: Part, b: Part): number {
	if (a.order !== b.order) return a.order - b.order;
	if (a.partId < b.partId) return -1;
	if (a.partId > b.partId) return 1;
	return 0;
}

type ReplacementDecision = { replacedByPartId: string };

function computeReplacementMap(parts: Part[]): Map<string, ReplacementDecision> {
	const byOriginal = new Map<string, Part[]>();
	for (const p of parts) {
		if (typeof p.replacesPartId === 'string' && p.replacesPartId.trim()) {
			const list = byOriginal.get(p.replacesPartId);
			if (list) list.push(p);
			else byOriginal.set(p.replacesPartId, [p]);
		}
	}

	const chosen = new Map<string, ReplacementDecision>();
	for (const [orig, candidates] of byOriginal.entries()) {
		candidates.sort((a, b) => {
			if (a.createdTurn !== b.createdTurn) return b.createdTurn - a.createdTurn;
			if (a.partId < b.partId) return -1;
			if (a.partId > b.partId) return 1;
			return 0;
		});
		const winner = candidates[0];
		if (winner) chosen.set(orig, { replacedByPartId: winner.partId });
	}
	return chosen;
}

function resolveReplacementChain(originalPartId: string, replacementMap: Map<string, ReplacementDecision>, maxDepth = 32): string | null {
	let current = originalPartId;
	let depth = 0;
	while (depth < maxDepth) {
		const next = replacementMap.get(current)?.replacedByPartId ?? null;
		if (!next) return current === originalPartId ? null : current;
		current = next;
		depth++;
	}
	return current === originalPartId ? null : current;
}

function isPartReplaced(part: Part, all: Part[], replacementMap: Map<string, ReplacementDecision>): boolean {
	const final = resolveReplacementChain(part.partId, replacementMap);
	if (!final) return false;
	if (final === part.partId) return false;
	return all.some((p) => p.partId === final);
}

function isSuppressedReplacer(part: Part, replacementMap: Map<string, ReplacementDecision>): boolean {
  const orig = part.replacesPartId;
  if (typeof orig !== 'string' || !orig.trim()) return false;
  const winner = replacementMap.get(orig)?.replacedByPartId ?? null;
  return Boolean(winner && winner !== part.partId);
}

export function getUiProjection(entry: Entry, variant: Variant | null, opts: UiProjectionOptions): Part[] {
	if (!variant) return [];
	if (entry.softDeleted) return [];

	const all = variant.parts ?? [];
	const replacementMap = computeReplacementMap(all);

	return all
		.filter((part) => {
			if (part.softDeleted) return false;
			if (isSuppressedReplacer(part, replacementMap)) return false;
			if (isPartReplaced(part, all, replacementMap)) return false;
			if (isTtlExpired(part, opts.currentTurn)) return false;
			const ui = part.visibility?.ui ?? 'always';
			return ui === 'always' || (ui === 'debug' && opts.debugEnabled);
		})
		.slice()
		.sort(compareParts);
}

