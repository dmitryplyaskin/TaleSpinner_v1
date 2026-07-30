import { describe, expect, test } from "vitest";

import { canAccessMediaPath } from "./trusted-owner-middleware";

describe("media owner paths", () => {
  const firstOwner = "11111111-1111-4111-8111-111111111111";
  const secondOwner = "22222222-2222-4222-8222-222222222222";

  test("only serves a namespaced image to its exact owner", () => {
    const path = `/images/custom/${firstOwner}/avatar.png`;
    expect(canAccessMediaPath(firstOwner, path)).toBe(true);
    expect(canAccessMediaPath(secondOwner, path)).toBe(false);
    expect(canAccessMediaPath("global", path)).toBe(false);
  });

  test("does not accept an owner id hidden in another path segment", () => {
    const path = `/images/${firstOwner}/${secondOwner}/avatar.png`;
    expect(canAccessMediaPath(firstOwner, path)).toBe(false);
  });

  test("keeps legacy and explicit global media available only to global", () => {
    expect(canAccessMediaPath("global", "/images/legacy/avatar.png")).toBe(
      true
    );
    expect(
      canAccessMediaPath("global", "/images/entity-profiles/global/avatar.png")
    ).toBe(true);
    expect(
      canAccessMediaPath(firstOwner, "/images/legacy/avatar.png")
    ).toBe(false);
  });
});
