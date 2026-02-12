import { describe, expect, test, vi } from "vitest";

import { DEFAULT_WORLD_INFO_ENTRY, buildDefaultWorldInfoSettings } from "./world-info-defaults";
import { scanWorldInfoEntries } from "./world-info-scanner";
import type { PreparedWorldInfoEntry, WorldInfoSettingsDto } from "./world-info-types";

function settings(patch: Partial<WorldInfoSettingsDto> = {}): WorldInfoSettingsDto {
  return {
    ...buildDefaultWorldInfoSettings(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...patch,
  };
}

function makeEntry(hash: string, patch: Partial<PreparedWorldInfoEntry>): PreparedWorldInfoEntry {
  return {
    ...DEFAULT_WORLD_INFO_ENTRY,
    uid: Number(hash.replace(/\D/g, "")) || 1,
    key: [],
    content: "",
    bookId: "book-1",
    bookName: "Book",
    hash,
    decorators: { activate: false, dontActivate: false },
    ...patch,
  } as PreparedWorldInfoEntry;
}

describe("world-info scanner", () => {
  test("applies budget gate with ignoreBudget exception", () => {
    const s = settings({
      budgetPercent: 25,
      contextWindowTokens: 8,
      recursive: false,
    });
    const withinBudget = makeEntry("e1", {
      constant: true,
      content: "tiny",
      order: 100,
    });
    const overflow = makeEntry("e2", {
      constant: true,
      content: "this is a long text",
      order: 90,
    });
    const ignoreBudget = makeEntry("e3", {
      constant: true,
      ignoreBudget: true,
      content: "this is also long",
      order: 80,
    });

    const out = scanWorldInfoEntries({
      entries: [withinBudget, overflow, ignoreBudget],
      settings: s,
      trigger: "normal",
      history: [],
      messageIndex: 10,
      scanSeed: "seed",
      dryRun: true,
      activeStickyHashes: new Set(),
      activeCooldownHashes: new Set(),
      personaDescription: "",
      characterDescription: "",
      characterPersonality: "",
      characterDepthPrompt: "",
      scenario: "",
      creatorNotes: "",
      charName: "",
      charTags: [],
    });

    const hashes = new Set(out.activatedEntries.map((item) => item.hash));
    expect(hashes.has("e1")).toBe(true);
    expect(hashes.has("e2")).toBe(false);
    expect(hashes.has("e3")).toBe(true);
  });

  test("supports recursion with delayUntilRecursion", () => {
    const s = settings({ recursive: true, maxRecursionSteps: 3 });
    const first = makeEntry("a", {
      key: ["dragon"],
      content: "elves",
      order: 100,
    });
    const second = makeEntry("b", {
      key: ["elves"],
      content: "elven lore",
      delayUntilRecursion: true,
      order: 90,
    });

    const out = scanWorldInfoEntries({
      entries: [first, second],
      settings: s,
      trigger: "normal",
      history: [{ role: "user", content: "dragon attack" }],
      messageIndex: 10,
      scanSeed: "seed-rec",
      dryRun: true,
      activeStickyHashes: new Set(),
      activeCooldownHashes: new Set(),
      personaDescription: "",
      characterDescription: "",
      characterPersonality: "",
      characterDepthPrompt: "",
      scenario: "",
      creatorNotes: "",
      charName: "",
      charTags: [],
    });

    const hashes = new Set(out.activatedEntries.map((item) => item.hash));
    expect(hashes.has("a")).toBe(true);
    expect(hashes.has("b")).toBe(true);
  });

  test("uses random probability roll", () => {
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const s = settings();
    const probabilistic = makeEntry("p", {
      constant: true,
      useProbability: true,
      probability: 10,
      content: "prob",
    });
    const out = scanWorldInfoEntries({
      entries: [probabilistic],
      settings: s,
      trigger: "normal",
      history: [],
      messageIndex: 0,
      scanSeed: "seed-random",
      dryRun: true,
      activeStickyHashes: new Set(),
      activeCooldownHashes: new Set(),
      personaDescription: "",
      characterDescription: "",
      characterPersonality: "",
      characterDepthPrompt: "",
      scenario: "",
      creatorNotes: "",
      charName: "",
      charTags: [],
    });
    expect(out.activatedEntries).toHaveLength(0);
    randomSpy.mockRestore();
  });
});
