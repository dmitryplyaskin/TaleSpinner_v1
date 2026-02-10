import { DEFAULT_UI_THEME_PAYLOAD } from "@shared/types/ui-theme";
import { describe, expect, test } from "vitest";


import { assertSafeCustomCss, validateUiThemePayload } from "./ui-theme-validator";

describe("ui theme validator", () => {
  test("accepts valid payload", () => {
    const payload = validateUiThemePayload(DEFAULT_UI_THEME_PAYLOAD);
    expect(payload.typography.uiBaseFontSize).toBe("16px");
  });

  test("rejects @import and url() in custom css", () => {
    expect(() => assertSafeCustomCss("@import url('x.css');")).toThrow();
    expect(() => assertSafeCustomCss(".x{background:url('https://x')}")).toThrow();
  });

  test("rejects style tags in custom css", () => {
    expect(() => assertSafeCustomCss("<style>.x{}</style>")).toThrow();
  });
});
