import { describe, expect, test } from "vitest";

import { resolveAppliedTokenId } from "./llm-presets-repository";

describe("llm-presets-repository helpers", () => {
  test("keeps token when it exists", () => {
    const resolved = resolveAppliedTokenId({
      tokenIds: ["a", "b"],
      requestedTokenId: "b",
    });

    expect(resolved).toEqual({ tokenId: "b" });
  });

  test("resets token and returns warning when token is missing", () => {
    const resolved = resolveAppliedTokenId({
      tokenIds: ["a", "b"],
      requestedTokenId: "missing",
    });

    expect(resolved).toEqual({
      tokenId: null,
      warning: "Preset token is missing and was reset: missing",
    });
  });
});
