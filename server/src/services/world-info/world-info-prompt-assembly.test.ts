import { describe, expect, test } from "vitest";

import { DEFAULT_WORLD_INFO_ENTRY, buildDefaultWorldInfoSettings } from "./world-info-defaults";
import { assembleWorldInfoPromptOutput } from "./world-info-prompt-assembly";
import type { PreparedWorldInfoEntry } from "./world-info-types";

function entry(hash: string, patch: Partial<PreparedWorldInfoEntry>): PreparedWorldInfoEntry {
  return {
    ...DEFAULT_WORLD_INFO_ENTRY,
    uid: Number(hash.replace(/\D/g, "")) || 1,
    content: `content-${hash}`,
    bookId: "book",
    bookName: "Book",
    hash,
    decorators: { activate: false, dontActivate: false },
    ...patch,
  } as PreparedWorldInfoEntry;
}

describe("world-info prompt assembly", () => {
  test("splits activated entries into prompt channels", () => {
    const settings = { ...buildDefaultWorldInfoSettings(), createdAt: new Date(), updatedAt: new Date() };
    const out = assembleWorldInfoPromptOutput({
      activatedEntries: [
        entry("b", { position: 0, comment: "Before" }),
        entry("a", { position: 1, comment: "After" }),
        entry("d", { position: 4, depth: 3, role: 2, comment: "Depth" }),
        entry("o", { position: 7, outletName: "lore", comment: "Outlet" }),
        entry("t", { position: 2, comment: "AN top" }),
        entry("m", { position: 6, comment: "EM bottom" }),
      ],
      settings,
    });

    expect(out.worldInfoBefore).toContain("Before:");
    expect(out.worldInfoAfter).toContain("After:");
    expect(out.depthEntries[0]?.depth).toBe(3);
    expect(out.depthEntries[0]?.role).toBe(2);
    expect(out.outletEntries.lore?.length).toBe(1);
    expect(out.anTop.length).toBe(1);
    expect(out.emBottom.length).toBe(1);
  });
});
