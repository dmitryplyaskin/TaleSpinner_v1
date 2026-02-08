import { describe, expect, test } from "vitest";

import { convertWorldInfoImport, exportWorldInfoBookToStNative } from "./world-info-converters";

describe("world-info converters", () => {
  test("auto-detects st_native and normalizes entries", () => {
    const converted = convertWorldInfoImport({
      raw: {
        name: "Book",
        entries: {
          "0": {
            keys: ["dragon"],
            content: "Dragons are ancient.",
          },
        },
      },
      format: "auto",
    });

    expect(converted.format).toBe("st_native");
    const first = converted.data.entries["0"] as { key?: string[] };
    expect(Array.isArray(first.key)).toBe(true);
    expect(first.key?.[0]).toBe("dragon");
  });

  test("converts character_book format", () => {
    const converted = convertWorldInfoImport({
      raw: {
        name: "Char",
        character_book: {
          entries: [{ id: 1, keys: ["elf"], content: "Elves." }],
        },
      },
      format: "character_book",
    });
    expect(Object.keys(converted.data.entries).length).toBe(1);
  });

  test("exports to st_native payload", () => {
    const out = exportWorldInfoBookToStNative({
      name: "Book",
      data: {
        entries: {
          "0": { uid: 0, key: ["a"], keysecondary: [], content: "x" },
        },
        extensions: {},
      },
    });
    expect((out as { entries?: unknown }).entries).toBeTruthy();
  });
});
