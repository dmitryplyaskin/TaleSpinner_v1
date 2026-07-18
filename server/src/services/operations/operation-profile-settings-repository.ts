import { eq } from "drizzle-orm";

import { initDb } from "../../db/client";
import { operationProfileSettings } from "../../db/schema";

export type OperationProfileSettingsDto = {
  activeProfileId: string | null;
  updatedAt: Date;
};

async function ensureSettingsRow(ownerId: string): Promise<OperationProfileSettingsDto> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(operationProfileSettings)
    .where(eq(operationProfileSettings.id, ownerId))
    .limit(1);

  if (rows[0]) {
    return {
      activeProfileId: rows[0].activeProfileId ?? null,
      updatedAt: rows[0].updatedAt,
    };
  }

  const now = new Date();
  await db.insert(operationProfileSettings).values({
    id: ownerId,
    activeProfileId: null,
    updatedAt: now,
  });

  return { activeProfileId: null, updatedAt: now };
}

export async function getOperationProfileSettings(params: {
  ownerId: string;
}): Promise<OperationProfileSettingsDto> {
  return ensureSettingsRow(params.ownerId);
}

export async function setActiveOperationProfile(params: {
  ownerId: string;
  activeProfileId: string | null;
}): Promise<OperationProfileSettingsDto> {
  const db = await initDb();
  const current = await ensureSettingsRow(params.ownerId);
  const now = new Date();

  await db
    .update(operationProfileSettings)
    .set({
      activeProfileId: params.activeProfileId,
      updatedAt: now,
    })
    .where(eq(operationProfileSettings.id, params.ownerId));

  return { ...current, activeProfileId: params.activeProfileId, updatedAt: now };
}

