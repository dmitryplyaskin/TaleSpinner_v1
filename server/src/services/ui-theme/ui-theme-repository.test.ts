import { describe, expect, test } from "vitest";

import {
  isBuiltInPresetId,
  resolveImportedPresetName,
} from "./ui-theme-repository";

describe("ui theme repository helpers", () => {
  test("detects built-in preset ids", () => {
    expect(isBuiltInPresetId("builtin-default-light-dark")).toBe(true);
    expect(isBuiltInPresetId("custom-id")).toBe(false);
  });

  test("resolves imported name collisions", () => {
    const result = resolveImportedPresetName("Night", ["Night", "Night (imported 2)"]);
    expect(result).toBe("Night (imported 3)");
  });
});

