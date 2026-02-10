import { describe, expect, test } from "vitest";

import { parseProviderConfig } from "./llm-definitions";

describe("llm-definitions.parseProviderConfig", () => {
  test("parses openrouter config with token policy/cache and allows passthrough fields", () => {
    const out = parseProviderConfig("openrouter", {
      defaultModel: "model-x",
      tokenPolicy: { randomize: true, fallbackOnError: true },
      anthropicCache: { enabled: true, depth: 2, ttl: "1h" },
      custom: "ok",
    });

    expect(out).toEqual({
      defaultModel: "model-x",
      tokenPolicy: { randomize: true, fallbackOnError: true },
      anthropicCache: { enabled: true, depth: 2, ttl: "1h" },
      custom: "ok",
    });
  });

  test("parses openai-compatible config and requires baseUrl", () => {
    const out = parseProviderConfig("openai_compatible", {
      baseUrl: "http://localhost:1234/v1",
      defaultModel: "m",
    });

    expect(out).toEqual({
      baseUrl: "http://localhost:1234/v1",
      defaultModel: "m",
    });
  });

  test("throws for openai-compatible config without baseUrl", () => {
    expect(() => parseProviderConfig("openai_compatible", {})).toThrow();
  });

  test("throws for invalid anthropic cache depth/ttl", () => {
    expect(() =>
      parseProviderConfig("openrouter", {
        anthropicCache: { enabled: true, depth: -1, ttl: "1h" },
      })
    ).toThrow();
    expect(() =>
      parseProviderConfig("openrouter", {
        anthropicCache: { enabled: true, depth: 0, ttl: "2h" },
      })
    ).toThrow();
  });
});
