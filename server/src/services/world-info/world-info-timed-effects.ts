import {
  deleteWorldInfoTimedEffectsByIds,
  listWorldInfoTimedEffects,
  upsertWorldInfoTimedEffect,
} from "./world-info-repositories";

import type { PreparedWorldInfoEntry } from "./world-info-types";

export type TimedEffectsState = {
  activeSticky: Set<string>;
  activeCooldown: Set<string>;
  warnings: string[];
};

export function isEntryDelayed(entry: PreparedWorldInfoEntry, messageIndex: number): boolean {
  if (typeof entry.delay !== "number") return false;
  if (!Number.isFinite(entry.delay)) return false;
  return entry.delay > 0 && messageIndex < entry.delay;
}

export async function loadTimedEffectsState(params: {
  ownerId: string;
  chatId: string;
  branchId: string;
  messageIndex: number;
  entriesByHash: Map<string, PreparedWorldInfoEntry>;
  dryRun: boolean;
}): Promise<TimedEffectsState> {
  if (params.dryRun) {
    return {
      activeSticky: new Set<string>(),
      activeCooldown: new Set<string>(),
      warnings: [],
    };
  }

  const rows = await listWorldInfoTimedEffects({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
  });

  const activeSticky = new Set<string>();
  const activeCooldown = new Set<string>();
  const deleteIds: string[] = [];
  const warnings: string[] = [];

  for (const row of rows) {
    if (row.endMessageIndex < params.messageIndex) {
      deleteIds.push(row.id);
      if (row.effectType === "sticky") {
        const entry = params.entriesByHash.get(row.entryHash);
        if (entry && typeof entry.cooldown === "number" && entry.cooldown > 0) {
          await upsertWorldInfoTimedEffect({
            ownerId: params.ownerId,
            chatId: params.chatId,
            branchId: params.branchId,
            entryHash: row.entryHash,
            bookId: entry.bookId,
            entryUid: entry.uid,
            effectType: "cooldown",
            startMessageIndex: params.messageIndex,
            endMessageIndex: params.messageIndex + entry.cooldown,
            protected: true,
          });
        }
      }
      continue;
    }

    if (row.effectType === "sticky") activeSticky.add(row.entryHash);
    if (row.effectType === "cooldown") activeCooldown.add(row.entryHash);
  }

  if (deleteIds.length > 0) {
    await deleteWorldInfoTimedEffectsByIds(deleteIds);
  }

  return { activeSticky, activeCooldown, warnings };
}

export async function applyTimedEffectsForActivatedEntries(params: {
  ownerId: string;
  chatId: string;
  branchId: string;
  messageIndex: number;
  activatedEntries: PreparedWorldInfoEntry[];
  dryRun: boolean;
}): Promise<void> {
  if (params.dryRun) return;
  for (const entry of params.activatedEntries) {
    if (typeof entry.sticky === "number" && entry.sticky > 0) {
      await upsertWorldInfoTimedEffect({
        ownerId: params.ownerId,
        chatId: params.chatId,
        branchId: params.branchId,
        entryHash: entry.hash,
        bookId: entry.bookId,
        entryUid: entry.uid,
        effectType: "sticky",
        startMessageIndex: params.messageIndex,
        endMessageIndex: params.messageIndex + entry.sticky,
      });
    }
    if (typeof entry.cooldown === "number" && entry.cooldown > 0) {
      await upsertWorldInfoTimedEffect({
        ownerId: params.ownerId,
        chatId: params.chatId,
        branchId: params.branchId,
        entryHash: entry.hash,
        bookId: entry.bookId,
        entryUid: entry.uid,
        effectType: "cooldown",
        startMessageIndex: params.messageIndex,
        endMessageIndex: params.messageIndex + entry.cooldown,
      });
    }
  }
}
