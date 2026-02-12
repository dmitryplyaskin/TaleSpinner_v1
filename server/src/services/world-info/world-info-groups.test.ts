import { describe, expect, test, vi } from "vitest";

import { DEFAULT_WORLD_INFO_ENTRY, buildDefaultWorldInfoSettings } from "./world-info-defaults";
import { applyInclusionGroups, type GroupCandidate } from "./world-info-groups";
import type { PreparedWorldInfoEntry } from "./world-info-types";

function entry(hash: string, patch: Partial<PreparedWorldInfoEntry>): PreparedWorldInfoEntry {
  return {
    ...DEFAULT_WORLD_INFO_ENTRY,
    uid: Number(hash.replace(/\D/g, "")) || 1,
    content: hash,
    bookId: "book",
    bookName: "Book",
    hash,
    decorators: { activate: false, dontActivate: false },
    ...patch,
  } as PreparedWorldInfoEntry;
}

function candidate(e: PreparedWorldInfoEntry, score = 0): GroupCandidate {
  return {
    entry: e,
    score,
    stickyActive: false,
    cooldownActive: false,
    delayed: false,
  };
}

describe("world-info groups", () => {
  test("group override picks highest order", () => {
    const settings = { ...buildDefaultWorldInfoSettings(), createdAt: new Date(), updatedAt: new Date() };
    const a = entry("a", { group: "g1", groupOverride: true, order: 10 });
    const b = entry("b", { group: "g1", groupOverride: true, order: 50 });
    const result = applyInclusionGroups({
      candidates: [candidate(a), candidate(b)],
      settings,
      scanSeed: "seed",
      alreadyActivatedGroups: new Set(),
    });
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].entry.hash).toBe("b");
  });

  test("weighted winner follows random roll", () => {
    const settings = { ...buildDefaultWorldInfoSettings(), createdAt: new Date(), updatedAt: new Date() };
    const a = entry("a", { group: "g2", groupWeight: 10 });
    const b = entry("b", { group: "g2", groupWeight: 90 });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.95);
    const result = applyInclusionGroups({
      candidates: [candidate(a), candidate(b)],
      settings,
      scanSeed: "seed-1",
      alreadyActivatedGroups: new Set(),
    });
    expect(result.selected[0].entry.hash).toBe("b");
    randomSpy.mockRestore();
  });

  test("group scoring keeps only max score candidates", () => {
    const settings = {
      ...buildDefaultWorldInfoSettings(),
      useGroupScoring: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const low = entry("low", { group: "g3", groupWeight: 100 });
    const high = entry("high", { group: "g3", groupWeight: 100 });
    const result = applyInclusionGroups({
      candidates: [candidate(low, 1), candidate(high, 3)],
      settings,
      scanSeed: "seed-2",
      alreadyActivatedGroups: new Set(),
    });
    expect(result.selected).toHaveLength(1);
    expect(result.selected[0].entry.hash).toBe("high");
  });
});
