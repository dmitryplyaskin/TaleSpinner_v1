import { DEFAULT_UI_THEME_PAYLOAD, UI_THEME_EXPORT_TYPE } from "@shared/types/ui-theme";
import { describe, expect, test } from "vitest";


import { uiThemeSettingsPatchSchema } from "../services/ui-theme/ui-theme-validator";

import { importBodySchema } from "./ui-theme.core.api";

describe("ui theme route schemas", () => {
  test("accepts settings patch with colorScheme", () => {
    const parsed = uiThemeSettingsPatchSchema.safeParse({ colorScheme: "dark" });
    expect(parsed.success).toBe(true);
  });

  test("rejects invalid settings patch keys", () => {
    const parsed = uiThemeSettingsPatchSchema.safeParse({ colorScheme: "blue" });
    expect(parsed.success).toBe(false);
  });

  test("accepts import body with one export payload", () => {
    const parsed = importBodySchema.safeParse({
      items: {
        type: UI_THEME_EXPORT_TYPE,
        version: 1,
        preset: {
          name: "Imported",
          payload: DEFAULT_UI_THEME_PAYLOAD,
        },
      },
    });
    expect(parsed.success).toBe(true);
  });
});
