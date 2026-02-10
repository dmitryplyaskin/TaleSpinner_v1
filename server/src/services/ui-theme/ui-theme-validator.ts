import {
  UI_THEME_EXPORT_TYPE,
  UI_THEME_EXPORT_VERSION,
  type UiThemeColorScheme,
  type UiThemeExportV1,
  type UiThemePresetPayload,
} from "@shared/types/ui-theme";
import { z } from "zod";

import { HttpError } from "@core/middleware/error-handler";

const MAX_TOKEN_VALUE_LENGTH = 4096;
const MAX_CUSTOM_CSS_LENGTH = 32768;
const TOKEN_KEY_RE = /^--[a-z0-9-]+$/;

const tokenMapSchema = z
  .record(z.string().regex(TOKEN_KEY_RE), z.string().min(1).max(MAX_TOKEN_VALUE_LENGTH))
  .default({});

const typographySchema = z
  .object({
    uiFontFamily: z.string().min(1).max(512),
    chatFontFamily: z.string().min(1).max(512),
    uiBaseFontSize: z.string().min(1).max(64),
    chatBaseFontSize: z.string().min(1).max(64),
    radiusXs: z.string().min(1).max(64),
    radiusSm: z.string().min(1).max(64),
    radiusMd: z.string().min(1).max(64),
    radiusLg: z.string().min(1).max(64),
    radiusXl: z.string().min(1).max(64),
  })
  .strict();

const markdownSchema = z
  .object({
    fontSize: z.string().min(1).max(64),
    lineHeight: z.string().min(1).max(64),
    codeFontSize: z.string().min(1).max(64),
    codePadding: z.string().min(1).max(128),
    quoteBorderWidth: z.string().min(1).max(64),
  })
  .strict();

export const uiThemePayloadSchema = z
  .object({
    lightTokens: tokenMapSchema,
    darkTokens: tokenMapSchema,
    typography: typographySchema,
    markdown: markdownSchema,
    customCss: z.string().max(MAX_CUSTOM_CSS_LENGTH).default(""),
  })
  .strict();

export const uiThemeCreateSchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    name: z.string().min(1).max(256),
    description: z.string().max(1024).optional(),
    payload: uiThemePayloadSchema,
  })
  .strict();

export const uiThemeUpdateSchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    name: z.string().min(1).max(256).optional(),
    description: z.string().max(1024).nullable().optional(),
    payload: uiThemePayloadSchema.optional(),
  })
  .strict();

export const uiThemeSettingsPatchSchema = z
  .object({
    ownerId: z.string().min(1).optional(),
    activePresetId: z.string().min(1).nullable().optional(),
    colorScheme: z.enum(["light", "dark", "auto"] satisfies UiThemeColorScheme[]).optional(),
  })
  .strict();

const uiThemeExportPresetSchema = z
  .object({
    name: z.string().min(1).max(256),
    description: z.string().max(1024).optional(),
    payload: uiThemePayloadSchema,
  })
  .strict();

export const uiThemeExportSchema: z.ZodType<UiThemeExportV1> = z
  .object({
    type: z.literal(UI_THEME_EXPORT_TYPE),
    version: z.literal(UI_THEME_EXPORT_VERSION),
    preset: uiThemeExportPresetSchema,
  })
  .strict();

export function assertSafeCustomCss(customCss: string): void {
  const css = customCss.trim();
  if (!css) return;
  if (css.length > MAX_CUSTOM_CSS_LENGTH) {
    throw new HttpError(400, "Custom CSS is too large", "VALIDATION_ERROR");
  }
  if (/@import/i.test(css)) {
    throw new HttpError(400, "Custom CSS must not contain @import", "VALIDATION_ERROR");
  }
  if (/url\s*\(/i.test(css)) {
    throw new HttpError(400, "Custom CSS must not contain url()", "VALIDATION_ERROR");
  }
  if (/<\/?style/i.test(css)) {
    throw new HttpError(400, "Custom CSS must not contain <style> tags", "VALIDATION_ERROR");
  }
}

export function validateUiThemePayload(payload: UiThemePresetPayload): UiThemePresetPayload {
  const parsed = uiThemePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, "Validation error", "VALIDATION_ERROR", {
      issues: parsed.error.issues,
    });
  }
  assertSafeCustomCss(parsed.data.customCss);
  return parsed.data;
}
