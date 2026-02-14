import fs from "node:fs/promises";

import { eq } from "drizzle-orm";

import { type AppSettings } from "@shared/types/app-settings";

import { initDb } from "../../db/client";
import { uiAppSettings } from "../../db/schema";
import { createDataPath } from "../../utils";

const SETTINGS_ROW_ID = "global";
const MAX_LEGACY_DATA_DEPTH = 32;

const DEFAULT_APP_SETTINGS: AppSettings = {
  language: "ru",
  openLastChat: false,
  autoSelectCurrentPersona: false,
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toLanguage(value: unknown): AppSettings["language"] | undefined {
  if (value === "ru" || value === "en") return value;
  return undefined;
}

function collectDataChain(input: unknown): Array<Record<string, unknown>> {
  const chain: Array<Record<string, unknown>> = [];
  let cursor: unknown = input;

  for (let depth = 0; depth < MAX_LEGACY_DATA_DEPTH; depth += 1) {
    if (!isObjectRecord(cursor)) break;
    chain.push(cursor);
    if (!isObjectRecord(cursor.data)) break;
    cursor = cursor.data;
  }

  return chain;
}

export function normalizeLegacyAppSettings(input: unknown): AppSettings {
  const chain = collectDataChain(input);
  if (chain.length === 0) return DEFAULT_APP_SETTINGS;

  const result: AppSettings = { ...DEFAULT_APP_SETTINGS };
  for (const item of chain) {
    const language = toLanguage(item.language);
    if (language) result.language = language;
    if (typeof item.openLastChat === "boolean") result.openLastChat = item.openLastChat;
    if (typeof item.autoSelectCurrentPersona === "boolean") {
      result.autoSelectCurrentPersona = item.autoSelectCurrentPersona;
    }
  }

  return result;
}

export function mergeAppSettings(
  current: AppSettings,
  patch: Partial<AppSettings>
): AppSettings {
  return {
    language: patch.language ?? current.language,
    openLastChat:
      typeof patch.openLastChat === "boolean"
        ? patch.openLastChat
        : current.openLastChat,
    autoSelectCurrentPersona:
      typeof patch.autoSelectCurrentPersona === "boolean"
        ? patch.autoSelectCurrentPersona
        : current.autoSelectCurrentPersona,
  };
}

function rowToDto(row: typeof uiAppSettings.$inferSelect): AppSettings {
  return {
    language: row.language,
    openLastChat: row.openLastChat,
    autoSelectCurrentPersona: row.autoSelectCurrentPersona,
  };
}

async function tryReadLegacyFile(): Promise<unknown> {
  const legacyPath = createDataPath("config", "app-settings.json");
  try {
    const raw = await fs.readFile(legacyPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function insertInitialSettings(settings: AppSettings): Promise<void> {
  const db = await initDb();
  const now = new Date();
  await db
    .insert(uiAppSettings)
    .values({
      id: SETTINGS_ROW_ID,
      language: settings.language,
      openLastChat: settings.openLastChat,
      autoSelectCurrentPersona: settings.autoSelectCurrentPersona,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: uiAppSettings.id,
      set: {
        language: settings.language,
        openLastChat: settings.openLastChat,
        autoSelectCurrentPersona: settings.autoSelectCurrentPersona,
        updatedAt: now,
      },
    });
}

export async function getAppSettings(): Promise<AppSettings> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(uiAppSettings)
    .where(eq(uiAppSettings.id, SETTINGS_ROW_ID))
    .limit(1);

  const existing = rows[0];
  if (existing) return rowToDto(existing);

  const legacy = await tryReadLegacyFile();
  const normalized = normalizeLegacyAppSettings(legacy);
  await insertInitialSettings(normalized);
  return normalized;
}

export async function updateAppSettings(
  patch: Partial<AppSettings>
): Promise<AppSettings> {
  const current = await getAppSettings();
  const next = mergeAppSettings(current, patch);

  const db = await initDb();
  const now = new Date();
  await db
    .insert(uiAppSettings)
    .values({
      id: SETTINGS_ROW_ID,
      language: next.language,
      openLastChat: next.openLastChat,
      autoSelectCurrentPersona: next.autoSelectCurrentPersona,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: uiAppSettings.id,
      set: {
        language: next.language,
        openLastChat: next.openLastChat,
        autoSelectCurrentPersona: next.autoSelectCurrentPersona,
        updatedAt: now,
      },
    });

  return next;
}
