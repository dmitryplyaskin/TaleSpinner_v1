import { describe, expect, test } from "vitest";

import { appSettingsPatchSchema } from "./app-settings-routes";

describe("app settings route schema", () => {
  test("rejects unsupported language", () => {
    const parsed = appSettingsPatchSchema.safeParse({ language: "de" });
    expect(parsed.success).toBe(false);
  });

  test("accepts valid patch keys", () => {
    const parsed = appSettingsPatchSchema.safeParse({
      language: "en",
      openLastChat: true,
      autoSelectCurrentPersona: false,
    });

    expect(parsed.success).toBe(true);
  });

  test("rejects unknown fields", () => {
    const parsed = appSettingsPatchSchema.safeParse({
      language: "ru",
      injected: "nope",
    });

    expect(parsed.success).toBe(false);
  });
});
