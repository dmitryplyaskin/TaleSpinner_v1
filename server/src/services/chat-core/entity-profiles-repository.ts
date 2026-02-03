import { asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { entityProfiles } from "../../db/schema";

export type EntityProfileDto = {
  id: string;
  ownerId: string;
  name: string;
  kind: "CharSpec";
  spec: unknown;
  meta: unknown | null;
  avatarAssetId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof entityProfiles.$inferSelect): EntityProfileDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    kind: row.kind,
    spec: safeJsonParse(row.specJson, {}),
    meta: safeJsonParse(row.metaJson, null),
    avatarAssetId: row.avatarAssetId ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listEntityProfiles(params?: {
  ownerId?: string;
}): Promise<EntityProfileDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(entityProfiles)
    .where(eq(entityProfiles.ownerId, params?.ownerId ?? "global"))
    .orderBy(asc(entityProfiles.name));
  return rows.map(rowToDto);
}

export async function getEntityProfileById(id: string): Promise<EntityProfileDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(entityProfiles)
    .where(eq(entityProfiles.id, id));
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createEntityProfile(params: {
  ownerId?: string;
  name: string;
  kind?: "CharSpec";
  spec: unknown;
  meta?: unknown;
  avatarAssetId?: string;
}): Promise<EntityProfileDto> {
  const db = await initDb();
  const ts = new Date();
  const id = uuidv4();

  await db.insert(entityProfiles).values({
    id,
    ownerId: params.ownerId ?? "global",
    name: params.name,
    kind: params.kind ?? "CharSpec",
    specJson: safeJsonStringify(params.spec, "{}"),
    metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    avatarAssetId: params.avatarAssetId ?? null,
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getEntityProfileById(id);
  // Should not happen, but keep runtime safe.
  if (!created) {
    return {
      id,
      ownerId: params.ownerId ?? "global",
      name: params.name,
      kind: params.kind ?? "CharSpec",
      spec: params.spec,
      meta: params.meta ?? null,
      avatarAssetId: params.avatarAssetId ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return created;
}

export async function updateEntityProfile(params: {
  id: string;
  name?: string;
  kind?: "CharSpec";
  spec?: unknown;
  meta?: unknown;
  avatarAssetId?: string | null;
}): Promise<EntityProfileDto | null> {
  const db = await initDb();
  const ts = new Date();

  const set: Partial<typeof entityProfiles.$inferInsert> = { updatedAt: ts };
  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.kind === "string") set.kind = params.kind;
  if (typeof params.spec !== "undefined") set.specJson = safeJsonStringify(params.spec, "{}");
  if (typeof params.meta !== "undefined") set.metaJson = safeJsonStringify(params.meta);
  if (typeof params.avatarAssetId !== "undefined") set.avatarAssetId = params.avatarAssetId;

  await db.update(entityProfiles).set(set).where(eq(entityProfiles.id, params.id));
  return getEntityProfileById(params.id);
}

export async function deleteEntityProfile(id: string): Promise<void> {
  const db = await initDb();
  await db.delete(entityProfiles).where(eq(entityProfiles.id, id));
}

