import { describe, expect, test } from "vitest";

import { anthropicCachePlugin } from "./anthropic-cache";

function makeCtx(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  return {
    providerId: "openrouter",
    model: "anthropic/claude-3.5-sonnet",
    messages,
    sampling: {},
    extra: {},
    headers: {},
    payload: { messages },
    features: {},
    abortSignal: undefined,
    logger: {
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
    },
  };
}

describe("anthropicCachePlugin", () => {
  test("matches only when feature enabled for anthropic-like models", () => {
    expect(
      anthropicCachePlugin.match?.({
        providerId: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        features: { anthropicCache: { enabled: true } },
      })
    ).toBe(true);
    expect(
      anthropicCachePlugin.match?.({
        providerId: "openrouter",
        model: "anthropic/claude-3.5-sonnet",
        features: {},
      })
    ).toBe(false);
    expect(
      anthropicCachePlugin.match?.({
        providerId: "openrouter",
        model: "gpt-4.1",
        features: { anthropicCache: { enabled: true } },
      })
    ).toBe(false);
  });

  test("mutateRequest adds cache_control at depth and depth+2", () => {
    const ctx = makeCtx([
      { role: "system", content: "sys" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "user", content: "u2" },
      { role: "assistant", content: "a2" },
      { role: "user", content: "u3" },
    ]);

    const out = anthropicCachePlugin.mutateRequest!(ctx as any, {
      enabled: true,
      depth: 0,
      ttl: "1h",
    });

    const patched = (out.payloadPatch as any).messages as any[];
    expect(patched).toHaveLength(6);

    expect(patched[5].content[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
    expect(patched[3].content[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "1h",
    });
    expect(patched[4].content[0]?.cache_control).toBeUndefined();
  });

  test("skips tail assistant prefill before depth calculation", () => {
    const ctx = makeCtx([
      { role: "system", content: "sys" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1" },
      { role: "assistant", content: "prefill" },
    ]);

    const out = anthropicCachePlugin.mutateRequest!(ctx as any, {
      enabled: true,
      depth: 0,
      ttl: "5m",
    });
    const patched = (out.payloadPatch as any).messages as any[];
    expect(patched[3].content[0]?.cache_control).toBeUndefined();
    expect(patched[2].content[0]?.cache_control).toBeUndefined();
    expect(patched[1].content[0].cache_control).toEqual({
      type: "ephemeral",
      ttl: "5m",
    });
  });
});
