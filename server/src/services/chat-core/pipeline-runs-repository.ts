import { and, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { pipelineRuns } from "../../db/schema";

export type PipelineRunStatus = "running" | "done" | "error" | "aborted";
export type PipelineRunTrigger =
  | "user_message"
  | "regenerate"
  | "manual"
  | "scheduled"
  | "api";

export type PipelineRunDto = {
  id: string;
  ownerId: string;
  chatId: string;
  entityProfileId: string;
  idempotencyKey: string | null;
  branchId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  assistantVariantId: string | null;
  generationId: string | null;
  activeProfileId: string | null;
  activeProfileVersion: number | null;
  trigger: PipelineRunTrigger;
  status: PipelineRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  meta: unknown | null;
};

function rowToDto(row: typeof pipelineRuns.$inferSelect): PipelineRunDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    chatId: row.chatId,
    entityProfileId: row.entityProfileId,
    idempotencyKey: row.idempotencyKey ?? null,
    branchId: row.branchId ?? null,
    userMessageId: row.userMessageId ?? null,
    assistantMessageId: row.assistantMessageId ?? null,
    assistantVariantId: row.assistantVariantId ?? null,
    generationId: row.generationId ?? null,
    activeProfileId: row.activeProfileId ?? null,
    activeProfileVersion: row.activeProfileVersion ?? null,
    trigger: row.trigger,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    meta: safeJsonParse(row.metaJson, null),
  };
}

export async function getPipelineRunByIdempotencyKey(params: {
  chatId: string;
  idempotencyKey: string;
}): Promise<PipelineRunDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.chatId, params.chatId),
        eq(pipelineRuns.idempotencyKey, params.idempotencyKey)
      )
    )
    .limit(1);

  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function ensurePipelineRun(params: {
  ownerId?: string;
  chatId: string;
  entityProfileId: string;
  trigger?: PipelineRunTrigger;
  idempotencyKey: string;
  branchId?: string | null;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  assistantVariantId?: string | null;
  generationId?: string | null;
  activeProfileId?: string | null;
  activeProfileVersion?: number | null;
  meta?: unknown;
}): Promise<{ run: PipelineRunDto; created: boolean }> {
  const db = await initDb();
  const key = params.idempotencyKey.trim();
  if (!key) {
    throw new Error("ensurePipelineRun requires non-empty idempotencyKey");
  }

  const existing = await getPipelineRunByIdempotencyKey({
    chatId: params.chatId,
    idempotencyKey: key,
  });
  if (existing) return { run: existing, created: false };

  const id = uuidv4();
  const ts = new Date();
  try {
    await db.insert(pipelineRuns).values({
      id,
      ownerId: params.ownerId ?? "global",
      chatId: params.chatId,
      entityProfileId: params.entityProfileId,
      idempotencyKey: key,
      trigger: params.trigger ?? "user_message",
      status: "running",
      startedAt: ts,
      finishedAt: null,
      branchId: params.branchId ?? null,
      userMessageId: params.userMessageId ?? null,
      assistantMessageId: params.assistantMessageId ?? null,
      assistantVariantId: params.assistantVariantId ?? null,
      generationId: params.generationId ?? null,
      activeProfileId: params.activeProfileId ?? null,
      activeProfileVersion: params.activeProfileVersion ?? null,
      metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    });
  } catch {
    const raced = await getPipelineRunByIdempotencyKey({
      chatId: params.chatId,
      idempotencyKey: key,
    });
    if (raced) return { run: raced, created: false };
    throw new Error("Failed to ensure pipeline run");
  }

  const rows = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, id)).limit(1);
  if (rows[0]) return { run: rowToDto(rows[0]), created: true };

  return {
    run: {
      id,
      ownerId: params.ownerId ?? "global",
      chatId: params.chatId,
      entityProfileId: params.entityProfileId,
      idempotencyKey: key,
      branchId: params.branchId ?? null,
      userMessageId: params.userMessageId ?? null,
      assistantMessageId: params.assistantMessageId ?? null,
      assistantVariantId: params.assistantVariantId ?? null,
      generationId: params.generationId ?? null,
      activeProfileId: params.activeProfileId ?? null,
      activeProfileVersion: params.activeProfileVersion ?? null,
      trigger: params.trigger ?? "user_message",
      status: "running",
      startedAt: ts,
      finishedAt: null,
      meta: params.meta ?? null,
    },
    created: true,
  };
}

export async function createPipelineRun(params: {
  ownerId?: string;
  chatId: string;
  entityProfileId: string;
  trigger?: PipelineRunTrigger;
  idempotencyKey?: string | null;
  branchId?: string | null;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  assistantVariantId?: string | null;
  generationId?: string | null;
  activeProfileId?: string | null;
  activeProfileVersion?: number | null;
  meta?: unknown;
}): Promise<PipelineRunDto> {
  const db = await initDb();
  if (typeof params.idempotencyKey === "string" && params.idempotencyKey.trim()) {
    const existing = await getPipelineRunByIdempotencyKey({
      chatId: params.chatId,
      idempotencyKey: params.idempotencyKey.trim(),
    });
    if (existing) return existing;
  }

  const id = uuidv4();
  const ts = new Date();

  try {
    await db.insert(pipelineRuns).values({
      id,
      ownerId: params.ownerId ?? "global",
      chatId: params.chatId,
      entityProfileId: params.entityProfileId,
      idempotencyKey:
        typeof params.idempotencyKey === "string" && params.idempotencyKey.trim()
          ? params.idempotencyKey.trim()
          : null,
      trigger: params.trigger ?? "user_message",
      status: "running",
      startedAt: ts,
      finishedAt: null,
      branchId: params.branchId ?? null,
      userMessageId: params.userMessageId ?? null,
      assistantMessageId: params.assistantMessageId ?? null,
      assistantVariantId: params.assistantVariantId ?? null,
      generationId: params.generationId ?? null,
      activeProfileId: params.activeProfileId ?? null,
      activeProfileVersion: params.activeProfileVersion ?? null,
      metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    });
  } catch (error) {
    // Race on unique idempotency key: read existing instead of failing.
    if (typeof params.idempotencyKey === "string" && params.idempotencyKey.trim()) {
      const existing = await getPipelineRunByIdempotencyKey({
        chatId: params.chatId,
        idempotencyKey: params.idempotencyKey.trim(),
      });
      if (existing) return existing;
    }
    throw error;
  }

  const rows = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, id));
  return rows[0] ? rowToDto(rows[0]) : {
    id,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    entityProfileId: params.entityProfileId,
    idempotencyKey:
      typeof params.idempotencyKey === "string" && params.idempotencyKey.trim()
        ? params.idempotencyKey.trim()
        : null,
    branchId: params.branchId ?? null,
    userMessageId: params.userMessageId ?? null,
    assistantMessageId: params.assistantMessageId ?? null,
    assistantVariantId: params.assistantVariantId ?? null,
    generationId: params.generationId ?? null,
    activeProfileId: params.activeProfileId ?? null,
    activeProfileVersion: params.activeProfileVersion ?? null,
    trigger: params.trigger ?? "user_message",
    status: "running",
    startedAt: ts,
    finishedAt: null,
    meta: params.meta ?? null,
  };
}

export async function finishPipelineRun(params: {
  id: string;
  status: Exclude<PipelineRunStatus, "running">;
  meta?: unknown;
}): Promise<void> {
  const db = await initDb();
  const ts = new Date();
  await db
    .update(pipelineRuns)
    .set({
      status: params.status,
      finishedAt: ts,
      metaJson: typeof params.meta === "undefined" ? undefined : safeJsonStringify(params.meta),
    })
    .where(eq(pipelineRuns.id, params.id));
}

export async function updatePipelineRunCorrelation(params: {
  id: string;
  branchId?: string | null;
  userMessageId?: string | null;
  assistantMessageId?: string | null;
  assistantVariantId?: string | null;
  generationId?: string | null;
}): Promise<void> {
  const db = await initDb();
  const set: Partial<typeof pipelineRuns.$inferInsert> = {};

  if (typeof params.branchId !== "undefined") set.branchId = params.branchId;
  if (typeof params.userMessageId !== "undefined") set.userMessageId = params.userMessageId;
  if (typeof params.assistantMessageId !== "undefined") {
    set.assistantMessageId = params.assistantMessageId;
  }
  if (typeof params.assistantVariantId !== "undefined") {
    set.assistantVariantId = params.assistantVariantId;
  }
  if (typeof params.generationId !== "undefined") set.generationId = params.generationId;

  if (Object.keys(set).length === 0) return;
  await db.update(pipelineRuns).set(set).where(eq(pipelineRuns.id, params.id));
}

