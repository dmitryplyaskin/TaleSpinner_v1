import { asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { pipelines } from "../../db/schema";

export type PipelineDto = {
  id: string;
  ownerId: string;
  name: string;
  enabled: boolean;
  definition: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof pipelines.$inferSelect): PipelineDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    enabled: row.enabled,
    definition: safeJsonParse(row.definitionJson, {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPipelines(params?: { ownerId?: string }): Promise<PipelineDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.ownerId, params?.ownerId ?? "global"))
    .orderBy(asc(pipelines.name));
  return rows.map(rowToDto);
}

export async function getPipelineById(id: string): Promise<PipelineDto | null> {
  const db = await initDb();
  const rows = await db.select().from(pipelines).where(eq(pipelines.id, id));
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createPipeline(params: {
  ownerId?: string;
  name: string;
  enabled?: boolean;
  definition: unknown;
}): Promise<PipelineDto> {
  const db = await initDb();
  const ts = new Date();
  const id = uuidv4();

  await db.insert(pipelines).values({
    id,
    ownerId: params.ownerId ?? "global",
    name: params.name,
    enabled: params.enabled ?? true,
    definitionJson: safeJsonStringify(params.definition, "{}"),
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getPipelineById(id);
  if (!created) {
    return {
      id,
      ownerId: params.ownerId ?? "global",
      name: params.name,
      enabled: params.enabled ?? true,
      definition: params.definition,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return created;
}

export async function updatePipeline(params: {
  id: string;
  name?: string;
  enabled?: boolean;
  definition?: unknown;
}): Promise<PipelineDto | null> {
  const db = await initDb();
  const ts = new Date();

  const set: Partial<typeof pipelines.$inferInsert> = { updatedAt: ts };
  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.enabled === "boolean") set.enabled = params.enabled;
  if (typeof params.definition !== "undefined") {
    set.definitionJson = safeJsonStringify(params.definition, "{}");
  }

  await db.update(pipelines).set(set).where(eq(pipelines.id, params.id));
  return getPipelineById(params.id);
}

export async function deletePipeline(id: string): Promise<void> {
  const db = await initDb();
  await db.delete(pipelines).where(eq(pipelines.id, id));
}

