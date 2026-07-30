import { describe, expect, test } from "vitest";

import { resolveAuthConfig } from "./auth-config";

describe("auth config", () => {
  test("provides local defaults without secrets", () => {
    expect(resolveAuthConfig({})).toMatchObject({
      policy: { mode: "local" },
      sessionCookieName: "talespinner_session",
      sessionTtlMs: 30 * 24 * 60 * 60 * 1000,
      sessionSecret: null,
      setupToken: null,
      allowRegistration: false,
      trustProxy: false,
    });
  });

  test("requires secrets in public mode", () => {
    expect(() =>
      resolveAuthConfig({
        TALESPINNER_ACCESS_MODE: "public",
        TALESPINNER_TRUST_PROXY: "true",
      })
    ).toThrow(/SESSION_SECRET/);

    expect(() =>
      resolveAuthConfig({
        TALESPINNER_ACCESS_MODE: "public",
        TALESPINNER_TRUST_PROXY: "true",
        TALESPINNER_SESSION_SECRET: "s".repeat(32),
      })
    ).toThrow(/SETUP_TOKEN/);
  });

  test("parses a complete public configuration", () => {
    expect(
      resolveAuthConfig({
        TALESPINNER_ACCESS_MODE: "public",
        TALESPINNER_SESSION_SECRET: "s".repeat(32),
        TALESPINNER_SETUP_TOKEN: "setup-token-value",
        TALESPINNER_ALLOW_REGISTRATION: "true",
        TALESPINNER_SESSION_TTL_DAYS: "7",
        TALESPINNER_TRUST_PROXY: "1",
      })
    ).toMatchObject({
      policy: { mode: "public" },
      sessionTtlMs: 7 * 24 * 60 * 60 * 1000,
      sessionSecret: "s".repeat(32),
      setupToken: "setup-token-value",
      allowRegistration: true,
      trustProxy: true,
    });
  });

  test("rejects invalid session TTL values", () => {
    expect(() =>
      resolveAuthConfig({ TALESPINNER_SESSION_TTL_DAYS: "0" })
    ).toThrow(/SESSION_TTL_DAYS/);
    expect(() =>
      resolveAuthConfig({ TALESPINNER_SESSION_TTL_DAYS: "abc" })
    ).toThrow(/SESSION_TTL_DAYS/);
  });
});
