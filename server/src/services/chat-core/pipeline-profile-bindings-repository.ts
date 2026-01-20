import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { initDb } from "../../db/client";
import { pipelineProfileBindings } from "../../db/schema";

export type PipelineProfileScope = "global" | "entity_profile" | "chat";

export type PipelineProfileBindingDto = {
  id: string;
  ownerId: string;
  scope: PipelineProfileScope;
  // Note: empty string means global scope.
  scopeId: string;
  profileId: string;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(
  row: typeof pipelineProfileBindings.$inferSelect
): PipelineProfileBindingDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    scope: row.scope,
    scopeId: row.scopeId,
    profileId: row.profileId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function normalizeScopeId(scope: PipelineProfileScope, scopeId?: string | null): string {
  if (scope === "global") return "";
  return typeof scopeId === "string" ? scopeId : "";
}

export async function getPipelineProfileBinding(params: {
  ownerId?: string;
  scope: PipelineProfileScope;
  scopeId?: string | null;
}): Promise<PipelineProfileBindingDto | null> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const scopeId = normalizeScopeId(params.scope, params.scopeId);
  const rows = await db
    .select()
    .from(pipelineProfileBindings)
    .where(
      and(
        eq(pipelineProfileBindings.ownerId, ownerId),
        eq(pipelineProfileBindings.scope, params.scope),
        eq(pipelineProfileBindings.scopeId, scopeId)
      )
    )
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function upsertPipelineProfileBinding(params: {
  ownerId?: string;
  scope: PipelineProfileScope;
  scopeId?: string | null;
  profileId: string;
}): Promise<PipelineProfileBindingDto> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const scopeId = normalizeScopeId(params.scope, params.scopeId);
  const now = new Date();

  const existing = await getPipelineProfileBinding({
    ownerId,
    scope: params.scope,
    scopeId,
  });

  if (existing) {
    await db
      .update(pipelineProfileBindings)
      .set({ profileId: params.profileId, updatedAt: now })
      .where(eq(pipelineProfileBindings.id, existing.id));
    const reread = await getPipelineProfileBinding({ ownerId, scope: params.scope, scopeId });
    return reread ?? { ...existing, profileId: params.profileId, updatedAt: now };
  }

  const id = uuidv4();
  await db.insert(pipelineProfileBindings).values({
    id,
    ownerId,
    scope: params.scope,
    scopeId,
    profileId: params.profileId,
    createdAt: now,
    updatedAt: now,
  });
  const created = await getPipelineProfileBinding({ ownerId, scope: params.scope, scopeId });
  return created ?? { id, ownerId, scope: params.scope, scopeId, profileId: params.profileId, createdAt: now, updatedAt: now };
}

export async function deletePipelineProfileBinding(params: {
  ownerId?: string;
  scope: PipelineProfileScope;
  scopeId?: string | null;
}): Promise<void> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const scopeId = normalizeScopeId(params.scope, params.scopeId);
  await db
    .delete(pipelineProfileBindings)
    .where(
      and(
        eq(pipelineProfileBindings.ownerId, ownerId),
        eq(pipelineProfileBindings.scope, params.scope),
        eq(pipelineProfileBindings.scopeId, scopeId)
      )
    );
}

