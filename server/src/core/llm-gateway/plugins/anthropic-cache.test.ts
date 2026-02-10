import { describe, expect, test } from "vitest";

import { anthropicCachePlugin } from "./anthropic-cache";

describe("anthropicCachePlugin", () => {
  test("matches anthropic-like model ids unless explicitly disabled", () => {
    expect(
      anthropicCachePlugin.match?.({
        providerId: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        features: {},
      })
    ).toBe(true);
    expect(
      anthropicCachePlugin.match?.({
        providerId: "openrouter",
        model: "claude-3-opus",
        features: {},
      })
    ).toBe(true);
    expect(
      anthropicCachePlugin.match?.({
        providerId: "openrouter",
        model: "gpt-4o-mini",
        features: {},
      })
    ).toBe(false);
    expect(
      anthropicCachePlugin.match?.({
        providerId: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        features: { anthropicCache: { enabled: false } },
      })
    ).toBe(false);
  });

  test("cache hook is no-op scaffold and delegates to next", async () => {
    const debugLogs: unknown[] = [];
    const next = async () => ({ text: "ok" });

    const out = await anthropicCachePlugin.cache!(
      {
        providerId: "openrouter",
        model: "anthropic/claude",
        messages: [],
        sampling: {},
        extra: {},
        headers: {},
        payload: {},
        features: {},
        abortSignal: undefined,
        logger: {
          debug: (msg, meta) => debugLogs.push({ msg, meta }),
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        },
      },
      { enabled: true, depth: 3 },
      next
    );

    expect(out).toEqual({ text: "ok" });
    expect(debugLogs).toHaveLength(1);
  });

  test("cache hook bypasses logging when feature disabled", async () => {
    const debug = () => {
      throw new Error("should not log when disabled");
    };
    const out = await anthropicCachePlugin.cache!(
      {
        providerId: "openrouter",
        model: "anthropic/claude",
        messages: [],
        sampling: {},
        extra: {},
        headers: {},
        payload: {},
        features: {},
        abortSignal: undefined,
        logger: {
          debug,
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        },
      },
      { enabled: false },
      async () => ({ text: "ok" })
    );

    expect(out).toEqual({ text: "ok" });
  });
});
