import { getGenerationByIdWithDebug } from "../../services/chat-core/generations-repository";
import {
  getActiveVariantWithParts,
  listEntries,
  softDeleteEntry,
} from "../../services/chat-entry-parts/entries-repository";
import { createPart } from "../../services/chat-entry-parts/parts-repository";
import {
  createVariant,
  deleteVariant,
  getVariantById,
  listEntryVariants,
  updateVariantDerived,
} from "../../services/chat-entry-parts/variants-repository";

import { pickPreviousUserEntries, resolveContinueUserTurnTarget } from "./chat-entry-helpers";

import type { DbExecutor } from "../../db/client";
import type { Entry, Part, Variant } from "@shared/types/chat-entry-parts";

export async function linkVariantToGeneration(params: {
  variantId: string;
  generationId: string;
}): Promise<void> {
  const variant = await getVariantById({ variantId: params.variantId });
  if (!variant) return;

  const derived =
    variant.derived && typeof variant.derived === "object" && !Array.isArray(variant.derived)
      ? { ...variant.derived }
      : {};
  derived.generationId = params.generationId;

  const generation = await getGenerationByIdWithDebug(params.generationId);
  if (generation?.promptHash) {
    derived.promptHash = generation.promptHash;
  }

  await updateVariantDerived({
    variantId: params.variantId,
    derived,
  });
}

export async function resolveRegenerateUserTurnTarget(params: {
  chatId: string;
  branchId: string;
  assistantEntry: Entry;
  currentTurn: number;
}): Promise<{ mode: "entry_parts"; userEntryId: string; userMainPartId: string } | undefined> {
  const pageLimit = 200;
  let before = params.assistantEntry.createdAt + 1;

  while (true) {
    const entries = await listEntries({
      chatId: params.chatId,
      branchId: params.branchId,
      limit: pageLimit,
      before,
    });
    if (entries.length === 0) return undefined;

    const userCandidates = pickPreviousUserEntries({
      entries,
      anchorEntryId: params.assistantEntry.entryId,
    });
    for (const candidate of userCandidates) {
      const candidateVariant = await getActiveVariantWithParts({ entry: candidate });
      try {
        const target = resolveContinueUserTurnTarget({
          lastEntry: candidate,
          lastVariant: candidateVariant,
          currentTurn: params.currentTurn,
        });
        return {
          mode: "entry_parts",
          userEntryId: target.userEntryId,
          userMainPartId: target.userMainPartId,
        };
      } catch {
        // Try the next older user entry candidate.
      }
    }

    const oldestEntry = entries[0];
    if (!oldestEntry) return undefined;
    before = oldestEntry.createdAt;
  }
}

export function createAssistantReasoningPart(params: {
  ownerId: string;
  variantId: string;
  createdTurn: number;
  requestId?: string;
  executor: DbExecutor;
}): Part {
  return createPart({
    ownerId: params.ownerId,
    variantId: params.variantId,
    channel: "reasoning",
    order: -1,
    payload: "",
    payloadFormat: "markdown",
    visibility: { ui: "always", prompt: false },
    ui: { rendererId: "markdown" },
    prompt: { serializerId: "asText" },
    lifespan: "infinite",
    createdTurn: params.createdTurn,
    source: "llm",
    requestId: params.requestId,
    executor: params.executor,
  });
}

function isVariantTextuallyEmpty(variant: Variant): boolean {
  const parts = (variant.parts ?? []).filter((part) => !part.softDeleted);
  if (parts.length === 0) return true;

  return parts.every((part) => {
    if (typeof part.payload !== "string") return false;
    return part.payload.trim().length === 0;
  });
}

export async function cleanupEmptyGenerationVariants(entryId: string): Promise<void> {
  let variants = await listEntryVariants({ entryId });
  for (const variant of variants) {
    if (variants.length <= 1) break;
    if (variant.kind !== "generation") continue;
    if (!isVariantTextuallyEmpty(variant)) continue;
    try {
      await deleteVariant({ entryId, variantId: variant.variantId });
    } catch {
      // best-effort cleanup; ignore failures for this variant
    }
    variants = variants.filter((item) => item.variantId !== variant.variantId);
  }
}

export async function finalizeChatGenerationArtifacts(params: {
  generationId: string | null;
  assistantVariantId: string;
  cleanupEntryId?: string;
  cleanupEmptyEntryId?: string;
}): Promise<void> {
  if (params.generationId) {
    await linkVariantToGeneration({
      variantId: params.assistantVariantId,
      generationId: params.generationId,
    });
  } else if (params.cleanupEmptyEntryId) {
    await softDeleteEntry({
      entryId: params.cleanupEmptyEntryId,
      by: "agent",
    });
  }

  if (params.cleanupEntryId) {
    await cleanupEmptyGenerationVariants(params.cleanupEntryId);
  }
}

export function createDetachedGenerationVariant(params: {
  ownerId: string;
  entryId: string;
  executor: DbExecutor;
}): Variant {
  return createVariant({
    ownerId: params.ownerId,
    entryId: params.entryId,
    kind: "generation",
    executor: params.executor,
  });
}
