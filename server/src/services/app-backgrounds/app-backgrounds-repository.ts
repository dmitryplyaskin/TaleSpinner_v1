import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import { resolveSafePath } from "@core/files/safe-path";
import { HttpError } from "@core/middleware/error-handler";
import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { initDb } from "../../db/client";
import { uiAppBackgrounds, uiAppSettings } from "../../db/schema";
import { createDataPath } from "../../utils";
import { getAppSettings } from "../app-settings/app-settings-repository";

import { loadBuiltInAppBackgrounds } from "./app-backgrounds-manifest";

import type {
  AppBackgroundActiveSelection,
  AppBackgroundAsset,
  AppBackgroundCatalog,
} from "@shared/types/app-background";

const APP_BACKGROUNDS_FOLDER = createDataPath("media", "images", "app-backgrounds");

type AppBackgroundRow = typeof uiAppBackgrounds.$inferSelect;

function rowToAsset(row: AppBackgroundRow): AppBackgroundAsset {
  return {
    id: row.id,
    name: row.name,
    source: "uploaded",
    imageUrl: `/media/images/app-backgrounds/${encodeURIComponent(row.fileName)}`,
    deletable: true,
  };
}

function resolveUploadedBackgroundName(originalName: string): string {
  const baseName = path.basename(originalName, path.extname(originalName)).trim();
  return baseName.length > 0 ? baseName : "Imported background";
}

async function ensureSettingsRow(): Promise<void> {
  await getAppSettings();
}

async function listUploadedBackgrounds(): Promise<AppBackgroundAsset[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(uiAppBackgrounds)
    .where(eq(uiAppBackgrounds.ownerId, resolveTrustedOwnerId()));
  return rows.map(rowToAsset);
}

async function readStoredActiveBackgroundId(): Promise<string | null> {
  await ensureSettingsRow();
  const db = await initDb();
  const rows = await db
    .select({ activeAppBackgroundId: uiAppSettings.activeAppBackgroundId })
    .from(uiAppSettings)
    .where(eq(uiAppSettings.id, resolveTrustedOwnerId()))
    .limit(1);
  return rows[0]?.activeAppBackgroundId ?? null;
}

async function persistActiveBackgroundId(activeBackgroundId: string | null): Promise<void> {
  await ensureSettingsRow();
  const db = await initDb();
  await db
    .update(uiAppSettings)
    .set({
      activeAppBackgroundId: activeBackgroundId,
      updatedAt: new Date(),
    })
    .where(eq(uiAppSettings.id, resolveTrustedOwnerId()));
}

export function mergeAppBackgroundAssets(
  builtInAssets: AppBackgroundAsset[],
  uploadedAssets: AppBackgroundAsset[]
): AppBackgroundAsset[] {
  return [...builtInAssets, ...uploadedAssets];
}

export function resolveActiveBackgroundId(params: {
  activeBackgroundId: string | null;
  items: AppBackgroundAsset[];
}): string | null {
  const activeItem = params.activeBackgroundId
    ? params.items.find((item) => item.id === params.activeBackgroundId)
    : null;
  if (activeItem) return activeItem.id;

  const builtIn = params.items.find((item) => item.source === "builtin");
  if (builtIn) return builtIn.id;

  return params.items[0]?.id ?? null;
}

export { loadBuiltInAppBackgrounds };

export async function getAppBackgroundCatalog(): Promise<AppBackgroundCatalog> {
  const [builtIns, uploads, storedActiveBackgroundId] = await Promise.all([
    loadBuiltInAppBackgrounds(),
    listUploadedBackgrounds(),
    readStoredActiveBackgroundId(),
  ]);
  const items = mergeAppBackgroundAssets(builtIns, uploads);
  const activeBackgroundId = resolveActiveBackgroundId({
    activeBackgroundId: storedActiveBackgroundId,
    items,
  });

  if (activeBackgroundId !== storedActiveBackgroundId) {
    await persistActiveBackgroundId(activeBackgroundId);
  }

  return { items, activeBackgroundId };
}

export async function setAppBackgroundActive(
  selection: AppBackgroundActiveSelection
): Promise<AppBackgroundActiveSelection> {
  const catalog = await getAppBackgroundCatalog();

  if (
    selection.activeBackgroundId !== null &&
    !catalog.items.some((item) => item.id === selection.activeBackgroundId)
  ) {
    throw new HttpError(404, "App background not found", "NOT_FOUND");
  }

  const activeBackgroundId = resolveActiveBackgroundId({
    activeBackgroundId: selection.activeBackgroundId,
    items: catalog.items,
  });
  await persistActiveBackgroundId(activeBackgroundId);
  return { activeBackgroundId };
}

export async function importAppBackground(params: {
  fileBuffer: Buffer;
  originalName: string;
}): Promise<AppBackgroundAsset> {
  const ownerId = resolveTrustedOwnerId();
  const ownerFolder = resolveSafePath(APP_BACKGROUNDS_FOLDER, ownerId);
  await fs.mkdir(ownerFolder, { recursive: true });

  const extension = path.extname(params.originalName).toLowerCase();
  const filename = `${ownerId}/${randomUUID()}${extension}`;
  const filePath = resolveSafePath(APP_BACKGROUNDS_FOLDER, filename);
  await fs.writeFile(filePath, params.fileBuffer);

  const now = new Date();
  const id = `upload:${randomUUID()}`;
  const db = await initDb();
  await db.insert(uiAppBackgrounds).values({
    id,
    ownerId,
    name: resolveUploadedBackgroundName(params.originalName),
    fileName: filename,
    createdAt: now,
    updatedAt: now,
  });

  return rowToAsset({
    id,
    ownerId,
    name: resolveUploadedBackgroundName(params.originalName),
    fileName: filename,
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteAppBackground(params: {
  id: string;
}): Promise<AppBackgroundActiveSelection & { deletedId: string }> {
  if (params.id.startsWith("builtin:")) {
    throw new HttpError(400, "Built-in backgrounds cannot be deleted", "VALIDATION_ERROR");
  }

  const db = await initDb();
  const rows = await db
    .select()
    .from(uiAppBackgrounds)
    .where(
      and(
        eq(uiAppBackgrounds.id, params.id),
        eq(uiAppBackgrounds.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) {
    throw new HttpError(404, "App background not found", "NOT_FOUND");
  }

  await db
    .delete(uiAppBackgrounds)
    .where(
      and(
        eq(uiAppBackgrounds.id, params.id),
        eq(uiAppBackgrounds.ownerId, resolveTrustedOwnerId())
      )
    );
  await fs.rm(resolveSafePath(APP_BACKGROUNDS_FOLDER, row.fileName), {
    force: true,
  });

  const catalog = await getAppBackgroundCatalog();
  return {
    deletedId: params.id,
    activeBackgroundId: catalog.activeBackgroundId,
  };
}
