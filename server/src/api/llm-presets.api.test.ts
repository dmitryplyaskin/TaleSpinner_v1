import { describe, expect, test } from "vitest";

import {
  llmPresetApplyBodySchema,
  llmPresetCreateBodySchema,
  llmPresetSettingsPatchSchema,
  llmPresetUpdateBodySchema,
} from "./llm-presets.api";

describe("llm presets route schemas", () => {
  test("create schema accepts valid payload", () => {
    const parsed = llmPresetCreateBodySchema.safeParse({
      name: "Preset A",
      payload: {
        activeProviderId: "openrouter",
        activeModel: "anthropic/claude-3.5-sonnet",
        activeTokenId: "tok-1",
        providerConfigsById: {
          openrouter: {
            defaultModel: "anthropic/claude-3.5-sonnet",
            tokenPolicy: { randomize: true, fallbackOnError: true },
            anthropicCache: { enabled: true, depth: 2, ttl: "1h" },
          },
        },
      },
    });

    expect(parsed.success).toBe(true);
  });

  test("update schema allows empty payload and route-level guard handles it", () => {
    const parsed = llmPresetUpdateBodySchema.safeParse({});
    expect(parsed.success).toBe(true);
  });

  test("apply schema validates scope/scopeId", () => {
    const ok = llmPresetApplyBodySchema.safeParse({
      scope: "agent",
      scopeId: "entity-1",
    });
    const fail = llmPresetApplyBodySchema.safeParse({
      scope: "agent",
      scopeId: "",
    });

    expect(ok.success).toBe(true);
    expect(fail.success).toBe(false);
  });

  test("settings patch schema accepts nullable active preset id", () => {
    const parsed = llmPresetSettingsPatchSchema.safeParse({
      activePresetId: null,
    });
    expect(parsed.success).toBe(true);
  });
});
