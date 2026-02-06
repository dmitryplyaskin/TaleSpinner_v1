import { and, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonStringifyForLog, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { llmGenerations } from "../../db/schema";

export type GenerationStatus = "streaming" | "done" | "aborted" | "error";

export type CreateGenerationParams = {
  ownerId?: string;
  chatId: string;
  branchId: string;
  messageId: string; // assistant message id
  variantId: string | null;
  providerId: string;
  model: string;
  settings: Record<string, unknown>;
};

export async function createGeneration(params: CreateGenerationParams): Promise<{
  id: string;
  startedAt: Date;
}> {
  const db = await initDb();
  const id = uuidv4();
  const ts = new Date();

  await db.insert(llmGenerations).values({
    id,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    branchId: params.branchId,
    messageId: params.messageId,
    variantId: params.variantId,
    providerId: params.providerId,
    model: params.model,
    paramsJson: safeJsonStringify(params.settings ?? {}, "{}"),
    status: "streaming",
    startedAt: ts,
    finishedAt: null,
    promptHash: null,
    promptSnapshotJson: null,
    phaseReportJson: null,
    commitReportJson: null,
    promptTokens: null,
    completionTokens: null,
    error: null,
  });

  return { id, startedAt: ts };
}

export type GenerationDto = {
  id: string;
  chatId: string;
  branchId: string | null;
  messageId: string;
  variantId: string | null;
  status: GenerationStatus;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
};

function rowToDto(row: typeof llmGenerations.$inferSelect): GenerationDto {
  return {
    id: row.id,
    chatId: row.chatId,
    branchId: row.branchId ?? null,
    messageId: row.messageId,
    variantId: row.variantId ?? null,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    error: row.error ?? null,
  };
}

export async function getGenerationById(id: string): Promise<GenerationDto | null> {
  const db = await initDb();
  const rows = await db.select().from(llmGenerations).where(eq(llmGenerations.id, id)).limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function getActiveGenerationForChatBranch(params: {
  chatId: string;
  branchId: string;
}): Promise<GenerationDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(llmGenerations)
    .where(
      and(
        eq(llmGenerations.chatId, params.chatId),
        eq(llmGenerations.branchId, params.branchId),
        eq(llmGenerations.status, "streaming")
      )
    )
    .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function finishGeneration(params: {
  id: string;
  status: GenerationStatus;
  error?: string | null;
}): Promise<void> {
  const db = await initDb();
  const finishedAt = new Date();
  await db
    .update(llmGenerations)
    .set({
      status: params.status,
      finishedAt,
      error: params.error ?? null,
    })
    .where(eq(llmGenerations.id, params.id));
}

export async function updateGenerationPromptData(params: {
  id: string;
  promptHash?: string | null;
  promptSnapshot?: unknown | null;
}): Promise<void> {
  const db = await initDb();
  const set: Partial<typeof llmGenerations.$inferInsert> = {};
  if (typeof params.promptHash !== "undefined") set.promptHash = params.promptHash;
  if (typeof params.promptSnapshot !== "undefined") {
    set.promptSnapshotJson =
      params.promptSnapshot === null
        ? null
        : safeJsonStringifyForLog(params.promptSnapshot, { maxChars: 60_000, fallback: "{}" });
  }
  if (Object.keys(set).length === 0) return;
  await db.update(llmGenerations).set(set).where(eq(llmGenerations.id, params.id));
}

export async function updateGenerationRunReports(params: {
  id: string;
  phaseReport?: unknown | null;
  commitReport?: unknown | null;
}): Promise<void> {
  const db = await initDb();
  const set: Partial<typeof llmGenerations.$inferInsert> = {};

  if (typeof params.phaseReport !== "undefined") {
    set.phaseReportJson =
      params.phaseReport === null
        ? null
        : safeJsonStringifyForLog(params.phaseReport, {
            maxChars: 120_000,
            fallback: "[]",
          });
  }

  if (typeof params.commitReport !== "undefined") {
    set.commitReportJson =
      params.commitReport === null
        ? null
        : safeJsonStringifyForLog(params.commitReport, {
            maxChars: 120_000,
            fallback: "[]",
          });
  }

  if (Object.keys(set).length === 0) return;
  await db.update(llmGenerations).set(set).where(eq(llmGenerations.id, params.id));
}

