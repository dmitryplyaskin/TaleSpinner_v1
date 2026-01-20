import { and, asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { pipelineProfiles } from "../../db/schema";

export type PipelineProfileDto = {
  id: string;
  ownerId: string;
  name: string;
  version: number;
  spec: unknown;
  meta: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof pipelineProfiles.$inferSelect): PipelineProfileDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    version: row.version,
    spec: safeJsonParse(row.specJson, {}),
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPipelineProfiles(params?: {
  ownerId?: string;
}): Promise<PipelineProfileDto[]> {
  const db = await initDb();
  const ownerId = params?.ownerId ?? "global";
  const rows = await db
    .select()
    .from(pipelineProfiles)
    .where(eq(pipelineProfiles.ownerId, ownerId))
    .orderBy(asc(pipelineProfiles.name));
  return rows.map(rowToDto);
}

export async function getPipelineProfileById(
  id: string
): Promise<PipelineProfileDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(pipelineProfiles)
    .where(eq(pipelineProfiles.id, id))
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createPipelineProfile(params: {
  ownerId?: string;
  name: string;
  spec: unknown;
  meta?: unknown;
}): Promise<PipelineProfileDto> {
  const db = await initDb();
  const ts = new Date();
  const id = uuidv4();
  const ownerId = params.ownerId ?? "global";

  await db.insert(pipelineProfiles).values({
    id,
    ownerId,
    name: params.name,
    version: 1,
    specJson: safeJsonStringify(params.spec, "{}"),
    metaJson:
      typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getPipelineProfileById(id);
  if (created) return created;
  return {
    id,
    ownerId,
    name: params.name,
    version: 1,
    spec: params.spec,
    meta: params.meta ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function updatePipelineProfile(params: {
  id: string;
  name?: string;
  spec?: unknown;
  meta?: unknown;
}): Promise<PipelineProfileDto | null> {
  const db = await initDb();
  const ts = new Date();

  const current = await getPipelineProfileById(params.id);
  if (!current) return null;

  // Any update bumps version (v1: coarse-grained versioning for reproducibility).
  const nextVersion = current.version + 1;

  const set: Partial<typeof pipelineProfiles.$inferInsert> = {
    updatedAt: ts,
    version: nextVersion,
  };
  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.spec !== "undefined") {
    set.specJson = safeJsonStringify(params.spec, "{}");
  }
  if (typeof params.meta !== "undefined") {
    set.metaJson = safeJsonStringify(params.meta);
  }

  await db.update(pipelineProfiles).set(set).where(eq(pipelineProfiles.id, params.id));
  return getPipelineProfileById(params.id);
}

export async function deletePipelineProfile(params: {
  id: string;
  ownerId?: string;
}): Promise<void> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  await db
    .delete(pipelineProfiles)
    .where(and(eq(pipelineProfiles.id, params.id), eq(pipelineProfiles.ownerId, ownerId)));
}

