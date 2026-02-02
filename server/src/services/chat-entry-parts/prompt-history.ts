import type { GenerateMessage } from "@shared/types/generate";

import { getBranchCurrentTurn } from "./branch-turn-repository";
import { listEntriesWithActiveVariants } from "./entries-repository";
import { getPromptProjection } from "./projection";
import { serializePart } from "./prompt-serializers";

export async function listProjectedPromptMessages(params: {
  chatId: string;
  branchId: string;
  limit: number;
  excludeEntryIds?: string[];
}): Promise<{ currentTurn: number; entryCount: number; messages: GenerateMessage[] }> {
  const currentTurn = await getBranchCurrentTurn({ branchId: params.branchId });
  const entries = await listEntriesWithActiveVariants({
    chatId: params.chatId,
    branchId: params.branchId,
    limit: params.limit,
    excludeEntryIds: params.excludeEntryIds,
  });

  const messages = getPromptProjection({
    entries,
    currentTurn,
    serializePart,
  });

  return { currentTurn, entryCount: entries.length, messages };
}

