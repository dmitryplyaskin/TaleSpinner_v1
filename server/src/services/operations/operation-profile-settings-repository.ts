import { eq } from "drizzle-orm";

import { initDb } from "../../db/client";
import { operationProfileSettings } from "../../db/schema";

export type OperationProfileSettingsDto = {
  activeProfileId: string | null;
  updatedAt: Date;
};

const SETTINGS_ROW_ID = "global";

async function ensureSettingsRow(): Promise<OperationProfileSettingsDto> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(operationProfileSettings)
    .where(eq(operationProfileSettings.id, SETTINGS_ROW_ID))
    .limit(1);

  if (rows[0]) {
    return {
      activeProfileId: rows[0].activeProfileId ?? null,
      updatedAt: rows[0].updatedAt,
    };
  }

  const now = new Date();
  await db.insert(operationProfileSettings).values({
    id: SETTINGS_ROW_ID,
    activeProfileId: null,
    updatedAt: now,
  });

  return { activeProfileId: null, updatedAt: now };
}

export async function getOperationProfileSettings(): Promise<OperationProfileSettingsDto> {
  return ensureSettingsRow();
}

export async function setActiveOperationProfile(params: {
  activeProfileId: string | null;
}): Promise<OperationProfileSettingsDto> {
  const db = await initDb();
  const current = await ensureSettingsRow();
  const now = new Date();

  await db
    .update(operationProfileSettings)
    .set({
      activeProfileId: params.activeProfileId,
      updatedAt: now,
    })
    .where(eq(operationProfileSettings.id, SETTINGS_ROW_ID));

  return { ...current, activeProfileId: params.activeProfileId, updatedAt: now };
}

