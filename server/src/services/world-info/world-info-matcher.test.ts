import { describe, expect, test } from "vitest";

import { DEFAULT_WORLD_INFO_ENTRY, buildDefaultWorldInfoSettings } from "./world-info-defaults";
import { matchEntryAgainstText } from "./world-info-matcher";
import type { PreparedWorldInfoEntry } from "./world-info-types";

function makeEntry(patch: Partial<PreparedWorldInfoEntry>): PreparedWorldInfoEntry {
  return {
    ...DEFAULT_WORLD_INFO_ENTRY,
    uid: 1,
    content: "",
    bookId: "book-1",
    bookName: "Book",
    hash: "h",
    decorators: { activate: false, dontActivate: false },
    ...patch,
  } as PreparedWorldInfoEntry;
}

describe("world-info matcher", () => {
  test("matches regex keys", () => {
    const entry = makeEntry({
      key: ["/dragons?/i"],
      keysecondary: [],
      selectiveLogic: 0,
    });
    const result = matchEntryAgainstText({
      entry,
      text: "A DRAGON appears",
      settings: { ...buildDefaultWorldInfoSettings(), createdAt: new Date(), updatedAt: new Date() },
    });
    expect(result.matched).toBe(true);
  });

  test("respects case sensitivity and whole words", () => {
    const settings = { ...buildDefaultWorldInfoSettings(), createdAt: new Date(), updatedAt: new Date() };
    const entryCase = makeEntry({
      key: ["Elf"],
      caseSensitive: true,
    });
    expect(
      matchEntryAgainstText({
        entry: entryCase,
        text: "elf",
        settings,
      }).matched
    ).toBe(false);

    const entryWhole = makeEntry({
      key: ["elf"],
      matchWholeWords: true,
      caseSensitive: false,
    });
    expect(
      matchEntryAgainstText({
        entry: entryWhole,
        text: "shelfish",
        settings,
      }).matched
    ).toBe(false);
  });

  test("supports all secondary logic modes", () => {
    const settings = { ...buildDefaultWorldInfoSettings(), createdAt: new Date(), updatedAt: new Date() };
    const base = {
      key: ["dragon"],
      keysecondary: ["moon", "forest"],
    };

    const andAny = makeEntry({ ...base, selectiveLogic: 0 });
    expect(
      matchEntryAgainstText({
        entry: andAny,
        text: "dragon and moon",
        settings,
      }).matched
    ).toBe(true);

    const notAll = makeEntry({ ...base, selectiveLogic: 1 });
    expect(
      matchEntryAgainstText({
        entry: notAll,
        text: "dragon moon",
        settings,
      }).matched
    ).toBe(true);

    const notAny = makeEntry({ ...base, selectiveLogic: 2 });
    expect(
      matchEntryAgainstText({
        entry: notAny,
        text: "dragon plains",
        settings,
      }).matched
    ).toBe(true);

    const andAll = makeEntry({ ...base, selectiveLogic: 3 });
    expect(
      matchEntryAgainstText({
        entry: andAll,
        text: "dragon moon forest",
        settings,
      }).matched
    ).toBe(true);
  });
});
