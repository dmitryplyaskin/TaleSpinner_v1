import {
  BUILT_IN_UI_THEME_PRESETS,
  UI_THEME_BUILT_IN_IDS,
  UI_THEME_EXPORT_TYPE,
  UI_THEME_EXPORT_VERSION,
  type UiThemeColorScheme,
  type UiThemeExportV1,
  type UiThemePreset,
  type UiThemePresetPayload,
  type UiThemeSettings,
} from "@shared/types/ui-theme";
import { and, desc, eq, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { HttpError } from "@core/middleware/error-handler";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { uiThemePresets, uiThemeSettings } from "../../db/schema";

import { validateUiThemePayload } from "./ui-theme-validator";

const DEFAULT_OWNER_ID = "global";
const DEFAULT_COLOR_SCHEME: UiThemeColorScheme = "auto";

type UiThemePresetRow = typeof uiThemePresets.$inferSelect;
type UiThemeSettingsRow = typeof uiThemeSettings.$inferSelect;
let builtInPresetsEnsured = false;
let builtInPresetsEnsureInFlight: Promise<void> | null = null;

export function isBuiltInPresetId(id: string): boolean {
  return Object.values(UI_THEME_BUILT_IN_IDS).includes(id as (typeof UI_THEME_BUILT_IN_IDS)[keyof typeof UI_THEME_BUILT_IN_IDS]);
}

export function resolveImportedPresetName(input: string, existingNames: string[]): string {
  const base = input.trim() || "Imported theme";
  if (!existingNames.includes(base)) return base;
  for (let idx = 2; idx <= 9999; idx += 1) {
    const candidate = `${base} (imported ${idx})`;
    if (!existingNames.includes(candidate)) return candidate;
  }
  return `${base} (imported ${Date.now()})`;
}

function rowToPreset(row: UiThemePresetRow): UiThemePreset {
  const payload = validateUiThemePayload(
    safeJsonParse<UiThemePresetPayload>(row.payloadJson, BUILT_IN_UI_THEME_PRESETS[0].payload)
  );
  return {
    presetId: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description ?? undefined,
    builtIn: row.builtIn,
    version: row.version,
    payload,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToSettings(row: UiThemeSettingsRow): UiThemeSettings {
  return {
    ownerId: row.ownerId,
    activePresetId: row.activePresetId,
    colorScheme: row.colorScheme,
    updatedAt: row.updatedAt,
  };
}

async function ensureBuiltInPresets(): Promise<void> {
  if (builtInPresetsEnsured) return;
  if (builtInPresetsEnsureInFlight) {
    await builtInPresetsEnsureInFlight;
    return;
  }

  builtInPresetsEnsureInFlight = (async () => {
    const db = await initDb();
    const now = new Date();
    for (const item of BUILT_IN_UI_THEME_PRESETS) {
      await db
        .insert(uiThemePresets)
        .values({
          id: item.id,
          ownerId: DEFAULT_OWNER_ID,
          name: item.name,
          description: item.description,
          builtIn: true,
          version: 1,
          payloadJson: safeJsonStringify(item.payload, "{}"),
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: uiThemePresets.id,
          set: {
            ownerId: DEFAULT_OWNER_ID,
            name: item.name,
            description: item.description,
            builtIn: true,
            version: 1,
            payloadJson: safeJsonStringify(item.payload, "{}"),
            updatedAt: now,
          },
        });
    }

    builtInPresetsEnsured = true;
  })();

  try {
    await builtInPresetsEnsureInFlight;
  } finally {
    builtInPresetsEnsureInFlight = null;
  }
}

async function ensureSettings(ownerId: string = DEFAULT_OWNER_ID): Promise<UiThemeSettings> {
  await ensureBuiltInPresets();
  const db = await initDb();
  const rows = await db.select().from(uiThemeSettings).where(eq(uiThemeSettings.ownerId, ownerId)).limit(1);
  if (rows[0]) return rowToSettings(rows[0]);

  const now = new Date();
  await db.insert(uiThemeSettings).values({
    ownerId,
    activePresetId: UI_THEME_BUILT_IN_IDS.default,
    colorScheme: DEFAULT_COLOR_SCHEME,
    updatedAt: now,
  });
  return {
    ownerId,
    activePresetId: UI_THEME_BUILT_IN_IDS.default,
    colorScheme: DEFAULT_COLOR_SCHEME,
    updatedAt: now,
  };
}

async function ensureActivePresetExists(ownerId: string): Promise<void> {
  const db = await initDb();
  const settings = await ensureSettings(ownerId);
  if (!settings.activePresetId) return;

  const found = await db
    .select()
    .from(uiThemePresets)
    .where(
      and(
        eq(uiThemePresets.id, settings.activePresetId),
        or(eq(uiThemePresets.ownerId, ownerId), eq(uiThemePresets.ownerId, DEFAULT_OWNER_ID))
      )
    )
    .limit(1);
  if (found[0]) return;

  const presets = await listUiThemePresets({ ownerId });
  const fallback = presets[0]?.presetId ?? UI_THEME_BUILT_IN_IDS.default;
  const now = new Date();
  await db
    .update(uiThemeSettings)
    .set({ activePresetId: fallback, updatedAt: now })
    .where(eq(uiThemeSettings.ownerId, ownerId));
}

export async function listUiThemePresets(params?: { ownerId?: string }): Promise<UiThemePreset[]> {
  const ownerId = params?.ownerId ?? DEFAULT_OWNER_ID;
  await ensureBuiltInPresets();
  const db = await initDb();
  const rows = await db
    .select()
    .from(uiThemePresets)
    .where(
      ownerId === DEFAULT_OWNER_ID
        ? eq(uiThemePresets.ownerId, DEFAULT_OWNER_ID)
        : or(eq(uiThemePresets.ownerId, ownerId), eq(uiThemePresets.ownerId, DEFAULT_OWNER_ID))
    )
    .orderBy(desc(uiThemePresets.builtIn), desc(uiThemePresets.updatedAt));
  return rows.map(rowToPreset);
}

export async function getUiThemePresetById(params: {
  presetId: string;
  ownerId?: string;
}): Promise<UiThemePreset | null> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  await ensureBuiltInPresets();
  const db = await initDb();
  const rows = await db
    .select()
    .from(uiThemePresets)
    .where(
      and(
        eq(uiThemePresets.id, params.presetId),
        ownerId === DEFAULT_OWNER_ID
          ? eq(uiThemePresets.ownerId, DEFAULT_OWNER_ID)
          : or(eq(uiThemePresets.ownerId, ownerId), eq(uiThemePresets.ownerId, DEFAULT_OWNER_ID))
      )
    )
    .limit(1);
  return rows[0] ? rowToPreset(rows[0]) : null;
}

export async function createUiThemePreset(params: {
  ownerId?: string;
  name: string;
  description?: string;
  payload: UiThemePresetPayload;
}): Promise<UiThemePreset> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  await ensureBuiltInPresets();
  const db = await initDb();
  const now = new Date();
  const presetId = uuidv4();
  const payload = validateUiThemePayload(params.payload);

  await db.insert(uiThemePresets).values({
    id: presetId,
    ownerId,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    builtIn: false,
    version: 1,
    payloadJson: safeJsonStringify(payload, "{}"),
    createdAt: now,
    updatedAt: now,
  });

  const created = await getUiThemePresetById({ presetId, ownerId });
  if (!created) throw new HttpError(500, "Failed to create theme preset");
  return created;
}

export async function updateUiThemePreset(params: {
  ownerId?: string;
  presetId: string;
  name?: string;
  description?: string | null;
  payload?: UiThemePresetPayload;
}): Promise<UiThemePreset> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const current = await getUiThemePresetById({ presetId: params.presetId, ownerId });
  if (!current) throw new HttpError(404, "UI theme preset not found", "NOT_FOUND");
  if (current.builtIn) {
    throw new HttpError(400, "Built-in presets are read-only", "VALIDATION_ERROR");
  }

  const nextPayload = params.payload ? validateUiThemePayload(params.payload) : current.payload;
  const now = new Date();
  const db = await initDb();

  await db
    .update(uiThemePresets)
    .set({
      name: typeof params.name === "string" ? params.name.trim() : current.name,
      description:
        typeof params.description === "string"
          ? params.description.trim()
          : params.description === null
            ? null
            : current.description ?? null,
      payloadJson: safeJsonStringify(nextPayload, "{}"),
      version: current.version + 1,
      updatedAt: now,
    })
    .where(and(eq(uiThemePresets.id, params.presetId), eq(uiThemePresets.ownerId, ownerId)));

  const updated = await getUiThemePresetById({ presetId: params.presetId, ownerId });
  if (!updated) throw new HttpError(500, "Failed to update theme preset");
  return updated;
}

export async function deleteUiThemePreset(params: {
  ownerId?: string;
  presetId: string;
}): Promise<void> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  const preset = await getUiThemePresetById({ presetId: params.presetId, ownerId });
  if (!preset) throw new HttpError(404, "UI theme preset not found", "NOT_FOUND");
  if (preset.builtIn) {
    throw new HttpError(400, "Built-in presets cannot be deleted", "VALIDATION_ERROR");
  }

  const db = await initDb();
  await db
    .delete(uiThemePresets)
    .where(and(eq(uiThemePresets.id, params.presetId), eq(uiThemePresets.ownerId, ownerId)));

  await ensureActivePresetExists(ownerId);
}

export async function exportUiThemePreset(params: {
  ownerId?: string;
  presetId: string;
}): Promise<UiThemeExportV1> {
  const preset = await getUiThemePresetById({
    ownerId: params.ownerId,
    presetId: params.presetId,
  });
  if (!preset) throw new HttpError(404, "UI theme preset not found", "NOT_FOUND");
  return {
    type: UI_THEME_EXPORT_TYPE,
    version: UI_THEME_EXPORT_VERSION,
    preset: {
      name: preset.name,
      description: preset.description,
      payload: preset.payload,
    },
  };
}

export async function importUiThemePresets(params: {
  ownerId?: string;
  items: UiThemeExportV1[];
}): Promise<UiThemePreset[]> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  await ensureBuiltInPresets();
  const existing = await listUiThemePresets({ ownerId });
  const names = new Set(existing.map((x) => x.name));

  const created: UiThemePreset[] = [];
  for (const item of params.items) {
    const name = resolveImportedPresetName(item.preset.name, Array.from(names));
    const row = await createUiThemePreset({
      ownerId,
      name,
      description: item.preset.description,
      payload: item.preset.payload,
    });
    names.add(row.name);
    created.push(row);
  }
  return created;
}

export async function getUiThemeSettings(params?: { ownerId?: string }): Promise<UiThemeSettings> {
  const ownerId = params?.ownerId ?? DEFAULT_OWNER_ID;
  await ensureBuiltInPresets();
  await ensureActivePresetExists(ownerId);
  return ensureSettings(ownerId);
}

export async function patchUiThemeSettings(params: {
  ownerId?: string;
  activePresetId?: string | null;
  colorScheme?: UiThemeColorScheme;
}): Promise<UiThemeSettings> {
  const ownerId = params.ownerId ?? DEFAULT_OWNER_ID;
  await ensureBuiltInPresets();
  const current = await ensureSettings(ownerId);

  if (typeof params.activePresetId === "string") {
    const exists = await getUiThemePresetById({ presetId: params.activePresetId, ownerId });
    if (!exists) {
      throw new HttpError(404, "UI theme preset not found", "NOT_FOUND");
    }
  }

  const nextActivePresetId =
    typeof params.activePresetId !== "undefined" ? params.activePresetId : current.activePresetId;
  const nextColorScheme = params.colorScheme ?? current.colorScheme;
  const now = new Date();

  const db = await initDb();
  await db
    .update(uiThemeSettings)
    .set({
      activePresetId: nextActivePresetId,
      colorScheme: nextColorScheme,
      updatedAt: now,
    })
    .where(eq(uiThemeSettings.ownerId, ownerId));

  return {
    ownerId,
    activePresetId: nextActivePresetId,
    colorScheme: nextColorScheme,
    updatedAt: now,
  };
}
