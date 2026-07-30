import { describe, expect, test } from "vitest";

import { createApp } from "../../app";

import { resolveAccessPolicy } from "./access-policy";

describe("access policy", () => {
  test("defaults to a frictionless local policy", () => {
    expect(resolveAccessPolicy({})).toEqual({
      mode: "local",
      passwordRequired: false,
      passwordlessLoginAllowed: true,
      automaticLoginAllowed: true,
      secureCookiesRequired: false,
      loginRateLimitRequired: false,
      csrfProtectionRequired: false,
    });
  });

  test("enables the complete public security policy", () => {
    expect(
      resolveAccessPolicy({ TALESPINNER_ACCESS_MODE: "public" })
    ).toEqual({
      mode: "public",
      passwordRequired: true,
      passwordlessLoginAllowed: false,
      automaticLoginAllowed: false,
      secureCookiesRequired: true,
      loginRateLimitRequired: true,
      csrfProtectionRequired: true,
    });
  });

  test("normalizes configured mode and rejects unknown values", () => {
    expect(
      resolveAccessPolicy({ TALESPINNER_ACCESS_MODE: " LOCAL " }).mode
    ).toBe("local");

    expect(() =>
      resolveAccessPolicy({ TALESPINNER_ACCESS_MODE: "shared" })
    ).toThrow(/TALESPINNER_ACCESS_MODE/);
  });

  test("exposes the active local policy to server middleware", () => {
    const previousMode = process.env.TALESPINNER_ACCESS_MODE;
    process.env.TALESPINNER_ACCESS_MODE = "local";

    try {
      expect(createApp().locals.accessPolicy).toMatchObject({
        mode: "local",
        passwordRequired: false,
      });
    } finally {
      if (typeof previousMode === "string") {
        process.env.TALESPINNER_ACCESS_MODE = previousMode;
      } else {
        delete process.env.TALESPINNER_ACCESS_MODE;
      }
    }
  });
});
