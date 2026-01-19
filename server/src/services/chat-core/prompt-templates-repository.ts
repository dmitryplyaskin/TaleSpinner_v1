import { and, desc, eq, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { promptTemplates } from "../../db/schema";

export type PromptTemplateScope = "global" | "entity_profile" | "chat";

export type PromptTemplateDto = {
  id: string;
  ownerId: string;
  name: string;
  enabled: boolean;
  scope: PromptTemplateScope;
  scopeId: string | null;
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
    enabled: row.enabled,
    scope: row.scope,
    scopeId: row.scopeId ?? null,
    engine: row.engine as "liquidjs",
    templateText: row.templateText,
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPromptTemplates(params: {
  ownerId?: string;
  scope: PromptTemplateScope;
  scopeId?: string;
}): Promise<PromptTemplateDto[]> {
  const db = await initDb();
  const scopeId = params.scopeId;
  if (params.scope === "global") {
    const rows = await db
      .select()
      .from(promptTemplates)
      .where(
        and(
          eq(promptTemplates.ownerId, params.ownerId ?? "global"),
          eq(promptTemplates.scope, "global"),
          isNull(promptTemplates.scopeId)
        )
      )
      .orderBy(desc(promptTemplates.updatedAt));
    return rows.map(rowToDto);
  }

  if (!scopeId) return [];

  const rows = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.ownerId, params.ownerId ?? "global"),
        eq(promptTemplates.scope, params.scope),
        eq(promptTemplates.scopeId, scopeId)
      )
    )
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
  ownerId?: string;
  name: string;
  enabled?: boolean;
  scope: PromptTemplateScope;
  scopeId?: string | null;
  engine?: "liquidjs";
  templateText: string;
  meta?: unknown;
}): Promise<PromptTemplateDto> {
  const db = await initDb();
  const ts = new Date();
  const id = uuidv4();

  await db.insert(promptTemplates).values({
    id,
    ownerId: params.ownerId ?? "global",
    name: params.name,
    enabled: params.enabled ?? true,
    scope: params.scope,
    scopeId: params.scope === "global" ? null : params.scopeId ?? null,
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
      enabled: params.enabled ?? true,
      scope: params.scope,
      scopeId: params.scope === "global" ? null : params.scopeId ?? null,
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
  enabled?: boolean;
  scope?: PromptTemplateScope;
  scopeId?: string | null;
  engine?: "liquidjs";
  templateText?: string;
  meta?: unknown;
}): Promise<PromptTemplateDto | null> {
  const db = await initDb();
  const ts = new Date();

  const current = await getPromptTemplateById(params.id);
  if (!current) return null;

  const finalScope: PromptTemplateScope = params.scope ?? current.scope;

  const set: Partial<typeof promptTemplates.$inferInsert> = { updatedAt: ts };
  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.enabled === "boolean") set.enabled = params.enabled;
  if (typeof params.scope === "string") set.scope = params.scope;
  if (typeof params.engine === "string") set.engine = params.engine;
  if (typeof params.templateText === "string")
    set.templateText = params.templateText;

  if (typeof params.scopeId !== "undefined") {
    set.scopeId = finalScope === "global" ? null : params.scopeId;
  }

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

export async function pickActivePromptTemplate(params: {
  ownerId?: string;
  chatId: string;
  entityProfileId: string;
}): Promise<PromptTemplateDto | null> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";

  const chatScoped = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.ownerId, ownerId),
        eq(promptTemplates.enabled, true),
        eq(promptTemplates.scope, "chat"),
        eq(promptTemplates.scopeId, params.chatId)
      )
    )
    .orderBy(desc(promptTemplates.updatedAt))
    .limit(1);
  if (chatScoped[0]) return rowToDto(chatScoped[0]);

  const profileScoped = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.ownerId, ownerId),
        eq(promptTemplates.enabled, true),
        eq(promptTemplates.scope, "entity_profile"),
        eq(promptTemplates.scopeId, params.entityProfileId)
      )
    )
    .orderBy(desc(promptTemplates.updatedAt))
    .limit(1);
  if (profileScoped[0]) return rowToDto(profileScoped[0]);

  const globalScoped = await db
    .select()
    .from(promptTemplates)
    .where(
      and(
        eq(promptTemplates.ownerId, ownerId),
        eq(promptTemplates.enabled, true),
        eq(promptTemplates.scope, "global"),
        isNull(promptTemplates.scopeId)
      )
    )
    .orderBy(desc(promptTemplates.updatedAt))
    .limit(1);

  return globalScoped[0] ? rowToDto(globalScoped[0]) : null;
}
