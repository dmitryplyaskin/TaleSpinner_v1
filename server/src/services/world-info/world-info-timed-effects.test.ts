import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listWorldInfoTimedEffects: vi.fn(),
  deleteWorldInfoTimedEffectsByIds: vi.fn(),
  upsertWorldInfoTimedEffect: vi.fn(),
}));

vi.mock("./world-info-repositories", () => ({
  listWorldInfoTimedEffects: mocks.listWorldInfoTimedEffects,
  deleteWorldInfoTimedEffectsByIds: mocks.deleteWorldInfoTimedEffectsByIds,
  upsertWorldInfoTimedEffect: mocks.upsertWorldInfoTimedEffect,
}));

import { DEFAULT_WORLD_INFO_ENTRY } from "./world-info-defaults";
import {
  applyTimedEffectsForActivatedEntries,
  isEntryDelayed,
  loadTimedEffectsState,
} from "./world-info-timed-effects";
import type { PreparedWorldInfoEntry } from "./world-info-types";

function makeEntry(hash: string, patch: Partial<PreparedWorldInfoEntry>): PreparedWorldInfoEntry {
  return {
    ...DEFAULT_WORLD_INFO_ENTRY,
    uid: 1,
    content: "x",
    bookId: "book-1",
    bookName: "Book",
    hash,
    decorators: { activate: false, dontActivate: false },
    ...patch,
  } as PreparedWorldInfoEntry;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("world-info timed effects", () => {
  test("delay check works", () => {
    const delayed = makeEntry("a", { delay: 5 });
    expect(isEntryDelayed(delayed, 3)).toBe(true);
    expect(isEntryDelayed(delayed, 6)).toBe(false);
  });

  test("loads active sticky/cooldown and marks dry-run warning for expired", async () => {
    mocks.listWorldInfoTimedEffects.mockResolvedValue([
      {
        id: "expired",
        ownerId: "global",
        chatId: "chat",
        branchId: "branch",
        entryHash: "h1",
        bookId: "b",
        entryUid: 1,
        effectType: "sticky",
        startMessageIndex: 1,
        endMessageIndex: 2,
        protected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "active-cd",
        ownerId: "global",
        chatId: "chat",
        branchId: "branch",
        entryHash: "h2",
        bookId: "b",
        entryUid: 2,
        effectType: "cooldown",
        startMessageIndex: 1,
        endMessageIndex: 8,
        protected: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const state = await loadTimedEffectsState({
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      messageIndex: 5,
      entriesByHash: new Map(),
      dryRun: true,
    });

    expect(state.activeCooldown.has("h2")).toBe(true);
    expect(state.warnings.length).toBeGreaterThan(0);
    expect(mocks.deleteWorldInfoTimedEffectsByIds).not.toHaveBeenCalled();
  });

  test("writes sticky and cooldown for activated entries", async () => {
    const entry = makeEntry("h3", { sticky: 2, cooldown: 4 });
    await applyTimedEffectsForActivatedEntries({
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      messageIndex: 10,
      activatedEntries: [entry],
      dryRun: false,
    });
    expect(mocks.upsertWorldInfoTimedEffect).toHaveBeenCalledTimes(2);
  });
});
