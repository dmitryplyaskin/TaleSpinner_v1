import { describe, expect, test } from "vitest";

import { parseProviderConfig } from "./llm-definitions";

describe("llm-definitions.parseProviderConfig", () => {
  test("parses openrouter config and allows passthrough fields", () => {
    const out = parseProviderConfig("openrouter", {
      defaultModel: "model-x",
      custom: "ok",
    });

    expect(out).toEqual({
      defaultModel: "model-x",
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
});
