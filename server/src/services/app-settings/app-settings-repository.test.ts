import { describe, expect, test } from "vitest";

import {
  mergeAppSettings,
  normalizeLegacyAppSettings,
} from "./app-settings-repository";

describe("app settings legacy normalization", () => {
  test("normalizes flat valid object", () => {
    const normalized = normalizeLegacyAppSettings({
      language: "en",
      openLastChat: true,
      autoSelectCurrentPersona: true,
    });

    expect(normalized).toEqual({
      language: "en",
      openLastChat: true,
      autoSelectCurrentPersona: true,
    });
  });

  test("unwraps recursive data chain and keeps deepest valid values", () => {
    const normalized = normalizeLegacyAppSettings({
      language: "ru",
      openLastChat: true,
      autoSelectCurrentPersona: false,
      data: {
        language: "en",
        openLastChat: false,
        autoSelectCurrentPersona: true,
      },
    });

    expect(normalized).toEqual({
      language: "en",
      openLastChat: false,
      autoSelectCurrentPersona: true,
    });
  });

  test("falls back for partially broken values", () => {
    const normalized = normalizeLegacyAppSettings({
      language: "de",
      openLastChat: "yes",
      autoSelectCurrentPersona: 1,
      data: { language: "ru" },
    });

    expect(normalized).toEqual({
      language: "ru",
      openLastChat: false,
      autoSelectCurrentPersona: false,
    });
  });

  test("returns defaults when source is missing or non-object", () => {
    expect(normalizeLegacyAppSettings(null)).toEqual({
      language: "ru",
      openLastChat: false,
      autoSelectCurrentPersona: false,
    });
    expect(normalizeLegacyAppSettings("")).toEqual({
      language: "ru",
      openLastChat: false,
      autoSelectCurrentPersona: false,
    });
  });
});

describe("app settings merge", () => {
  test("updates only whitelist fields", () => {
    const current = {
      language: "ru" as const,
      openLastChat: false,
      autoSelectCurrentPersona: false,
    };
    const merged = mergeAppSettings(current, {
      language: "en",
      openLastChat: true,
    } as any);

    expect(merged).toEqual({
      language: "en",
      openLastChat: true,
      autoSelectCurrentPersona: false,
    });
  });
});
