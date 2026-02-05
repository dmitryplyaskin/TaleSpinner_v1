import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chats, promptTemplates } from "../../db/schema";

export type PromptTemplateDto = {
  id: string;
  ownerId: string;
  name: string;
  engine: "liquidjs";
  templateText: string;
  meta: unknown | null;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof promptTemplates.$inferSelect): PromptTemplateDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    engine: row.engine as "liquidjs",
    templateText: row.templateText,
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPromptTemplates(params: {
  ownerId?: string;
}): Promise<PromptTemplateDto[]> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const rows = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.ownerId, ownerId))
    .orderBy(desc(promptTemplates.updatedAt));
  return rows.map(rowToDto);
}

export async function getPromptTemplateById(
  id: string
): Promise<PromptTemplateDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(promptTemplates)
    .where(eq(promptTemplates.id, id));
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createPromptTemplate(params: {
  id?: string;
  ownerId?: string;
  name: string;
  engine?: "liquidjs";
  templateText: string;
  meta?: unknown;
}): Promise<PromptTemplateDto> {
  const db = await initDb();
  const ts = new Date();
  const id = typeof params.id === "string" && params.id.length > 0 ? params.id : uuidv4();

  await db.insert(promptTemplates).values({
    id,
    ownerId: params.ownerId ?? "global",
    name: params.name,
    engine: params.engine ?? "liquidjs",
    templateText: params.templateText,
    metaJson:
      typeof params.meta === "undefined"
        ? null
        : safeJsonStringify(params.meta),
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getPromptTemplateById(id);
  if (!created) {
    return {
      id,
      ownerId: params.ownerId ?? "global",
      name: params.name,
      engine: params.engine ?? "liquidjs",
      templateText: params.templateText,
      meta: params.meta ?? null,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return created;
}

export async function updatePromptTemplate(params: {
  id: string;
  name?: string;
  engine?: "liquidjs";
  templateText?: string;
  meta?: unknown;
}): Promise<PromptTemplateDto | null> {
  const db = await initDb();
  const ts = new Date();

  if (!(await getPromptTemplateById(params.id))) return null;

  const set: Partial<typeof promptTemplates.$inferInsert> = { updatedAt: ts };
  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.engine === "string") set.engine = params.engine;
  if (typeof params.templateText === "string")
    set.templateText = params.templateText;

  if (typeof params.meta !== "undefined") {
    set.metaJson = safeJsonStringify(params.meta);
  }

  await db
    .update(promptTemplates)
    .set(set)
    .where(eq(promptTemplates.id, params.id));
  return getPromptTemplateById(params.id);
}

export async function deletePromptTemplate(id: string): Promise<void> {
  const db = await initDb();
  await db.delete(promptTemplates).where(eq(promptTemplates.id, id));
}

export async function pickPromptTemplateForChat(params: {
  ownerId?: string;
  chatId: string;
}): Promise<PromptTemplateDto | null> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";

  const chatRows = await db
    .select({ promptTemplateId: chats.promptTemplateId })
    .from(chats)
    .where(and(eq(chats.ownerId, ownerId), eq(chats.id, params.chatId)))
    .limit(1);
  const promptTemplateId = chatRows[0]?.promptTemplateId ?? null;
  if (!promptTemplateId) return null;

  const rows = await db
    .select()
    .from(promptTemplates)
    .where(
      and(eq(promptTemplates.ownerId, ownerId), eq(promptTemplates.id, promptTemplateId))
    )
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}
