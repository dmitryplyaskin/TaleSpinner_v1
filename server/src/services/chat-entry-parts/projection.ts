import type { Entry, Part, Variant } from "@shared/types/chat-entry-parts";
import type { GenerateMessage } from "@shared/types/generate";

type UiProjectionOptions = {
  debugEnabled: boolean;
};

function isTtlExpired(part: Part, currentTurn: number): boolean {
  if (part.lifespan === "infinite") return false;
  return currentTurn - part.createdTurn >= part.lifespan.turns;
}

function compareParts(a: Part, b: Part): number {
  if (a.order !== b.order) return a.order - b.order;
  if (a.partId < b.partId) return -1;
  if (a.partId > b.partId) return 1;
  return 0;
}

type ReplacementDecision = {
  replacedByPartId: string;
};

function computeReplacementMap(parts: Part[]): Map<string, ReplacementDecision> {
  // Key: original partId, Value: chosen replacement.
  //
  // If multiple parts replace the same original, we pick a deterministic winner.
  // Rule (v1): prefer higher createdTurn, then lexical partId.
  const byOriginal = new Map<string, Part[]>();
  for (const p of parts) {
    if (typeof p.replacesPartId === "string" && p.replacesPartId.trim()) {
      const k = p.replacesPartId;
      const list = byOriginal.get(k);
      if (list) list.push(p);
      else byOriginal.set(k, [p]);
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
    if (winner) {
      chosen.set(orig, { replacedByPartId: winner.partId });
    }
  }
  return chosen;
}

function resolveReplacementChain(
  originalPartId: string,
  replacementMap: Map<string, ReplacementDecision>,
  maxDepth = 32
): string | null {
  // Returns the final replacing partId (transitively), or null if not replaced.
  let current = originalPartId;
  let depth = 0;
  while (depth < maxDepth) {
    const next = replacementMap.get(current)?.replacedByPartId ?? null;
    if (!next) return current === originalPartId ? null : current;
    current = next;
    depth++;
  }
  // Cycle or too deep chain; treat as replaced to prevent leaking originals.
  return current === originalPartId ? null : current;
}

function isPartReplaced(part: Part, parts: Part[], replacementMap: Map<string, ReplacementDecision>): boolean {
  // A part is considered replaced if there exists a replacement chain starting from its partId.
  // Also: if this part itself is a replacer, it is not "replaced" by that fact alone.
  const final = resolveReplacementChain(part.partId, replacementMap);
  if (!final) return false;
  // If chain resolves to itself, it is not replaced.
  if (final === part.partId) return false;
  // If chain resolves to another partId that exists, treat this part as replaced.
  return parts.some((p) => p.partId === final);
}

function isSuppressedReplacer(part: Part, replacementMap: Map<string, ReplacementDecision>): boolean {
  // If multiple parts replace the same original, only the chosen winner stays active.
  const orig = part.replacesPartId;
  if (typeof orig !== "string" || !orig.trim()) return false;
  const winner = replacementMap.get(orig)?.replacedByPartId ?? null;
  return Boolean(winner && winner !== part.partId);
}

export function getUiProjection(entry: Entry, variant: Variant, currentTurn: number, opts: UiProjectionOptions): Part[] {
  if (entry.softDeleted) return [];

  const all = variant.parts ?? [];
  const replacementMap = computeReplacementMap(all);

  return all
    .filter((part) => {
      if (part.softDeleted) return false;
      if (isSuppressedReplacer(part, replacementMap)) return false;
      if (isPartReplaced(part, all, replacementMap)) return false;
      if (isTtlExpired(part, currentTurn)) return false;
      const ui = part.visibility?.ui ?? "always";
      return ui === "always" || (ui === "debug" && opts.debugEnabled);
    })
    .slice()
    .sort(compareParts);
}

export function getPromptProjection(params: {
  entries: Array<{ entry: Entry; variant: Variant | null }>;
  currentTurn: number;
  serializePart: (part: Part) => string;
}): GenerateMessage[] {
  const messages: GenerateMessage[] = [];

  for (const { entry, variant } of params.entries) {
    if (entry.softDeleted) continue;
    if (entry.meta?.excludedFromPrompt === true) continue;
    if (!variant) continue;

    const all = variant.parts ?? [];
    const replacementMap = computeReplacementMap(all);

    const parts = all
      .filter((part) => {
        if (part.softDeleted) return false;
        if (isSuppressedReplacer(part, replacementMap)) return false;
        if (isPartReplaced(part, all, replacementMap)) return false;
        if (isTtlExpired(part, params.currentTurn)) return false;
        return part.visibility?.prompt === true;
      })
      .slice()
      .sort(compareParts);

    const content = parts.map(params.serializePart).filter((s) => s.trim().length > 0).join("\n\n");
    if (!content.trim()) continue;

    messages.push({ role: entry.role, content });
  }

  return messages;
}

