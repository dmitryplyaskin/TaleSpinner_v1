import { randomUUID as uuidv4 } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";

import {
  safeJsonParse,
  safeJsonStringify,
  safeJsonStringifyForLog,
} from "../../chat-core/json";
import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { type DbExecutor, initDb } from "../../db/client";
import { chatBranches, chats, llmGenerations } from "../../db/schema";

export type GenerationStatus = "streaming" | "done" | "aborted" | "error";

export type CreateGenerationParams = {
  ownerId?: string;
  chatId: string;
  branchId: string;
  messageId: string | null;
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
  const ownerId = resolveTrustedOwnerId(params.ownerId);
  const branch = await db
    .select({ id: chatBranches.id })
    .from(chatBranches)
    .innerJoin(chats, eq(chats.id, chatBranches.chatId))
    .where(
      and(
        eq(chats.id, params.chatId),
        eq(chats.ownerId, ownerId),
        eq(chatBranches.id, params.branchId),
        eq(chatBranches.ownerId, ownerId)
      )
    )
    .limit(1);
  if (!branch[0]) throw new Error("Chat branch не найден");

  await db.insert(llmGenerations).values({
    id,
    ownerId,
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
    debugJson: null,
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
  messageId: string | null;
  variantId: string | null;
  status: GenerationStatus;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
};

export type GenerationWithDebugDto = GenerationDto & {
  promptHash: string | null;
  promptSnapshot: unknown | null;
  debug: unknown | null;
};

function rowToDto(row: typeof llmGenerations.$inferSelect): GenerationDto {
  return {
    id: row.id,
    chatId: row.chatId,
    branchId: row.branchId ?? null,
    messageId: row.messageId ?? null,
    variantId: row.variantId ?? null,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    error: row.error ?? null,
  };
}

function rowToWithDebugDto(
  row: typeof llmGenerations.$inferSelect
): GenerationWithDebugDto {
  const base = rowToDto(row);
  return {
    ...base,
    promptHash: row.promptHash ?? null,
    promptSnapshot: safeJsonParse(row.promptSnapshotJson, null),
    debug: safeJsonParse(row.debugJson, null),
  };
}

export async function getGenerationById(id: string): Promise<GenerationDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(llmGenerations)
    .where(
      and(
        eq(llmGenerations.id, id),
        eq(llmGenerations.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
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
        eq(llmGenerations.ownerId, resolveTrustedOwnerId()),
        eq(llmGenerations.status, "streaming")
      )
    )
    .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

type FinishGenerationParams = {
  id: string;
  status: GenerationStatus;
  error?: string | null;
  executor?: DbExecutor;
};

export function finishGeneration(params: FinishGenerationParams & { executor: DbExecutor }): void;
export function finishGeneration(params: FinishGenerationParams): Promise<void>;
export function finishGeneration(params: FinishGenerationParams): Promise<void> | void {
  const ownerId = resolveTrustedOwnerId();
  const run = (db: DbExecutor): void => {
    const finishedAt = new Date();
    db
      .update(llmGenerations)
      .set({
        status: params.status,
        finishedAt,
        error: params.error ?? null,
      })
      .where(
        and(
          eq(llmGenerations.id, params.id),
          eq(llmGenerations.ownerId, ownerId)
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
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
  await db
    .update(llmGenerations)
    .set(set)
    .where(
      and(
        eq(llmGenerations.id, params.id),
        eq(llmGenerations.ownerId, resolveTrustedOwnerId())
      )
    );
}

export async function getGenerationByIdWithDebug(
  id: string
): Promise<GenerationWithDebugDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(llmGenerations)
    .where(
      and(
        eq(llmGenerations.id, id),
        eq(llmGenerations.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  return rows[0] ? rowToWithDebugDto(rows[0]) : null;
}

type UpdateGenerationRunReportsParams = {
  id: string;
  phaseReport?: unknown | null;
  commitReport?: unknown | null;
  executor?: DbExecutor;
};

export function updateGenerationRunReports(
  params: UpdateGenerationRunReportsParams & { executor: DbExecutor }
): void;
export function updateGenerationRunReports(
  params: UpdateGenerationRunReportsParams
): Promise<void>;
export function updateGenerationRunReports(
  params: UpdateGenerationRunReportsParams
): Promise<void> | void {
  const ownerId = resolveTrustedOwnerId();
  const run = (db: DbExecutor): void => {
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
    db
      .update(llmGenerations)
      .set(set)
      .where(
        and(
          eq(llmGenerations.id, params.id),
          eq(llmGenerations.ownerId, ownerId)
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function updateGenerationDebugJson(params: {
  id: string;
  debug?: unknown | null;
}): Promise<void> {
  if (typeof params.debug === "undefined") return;
  const db = await initDb();
  await db
    .update(llmGenerations)
    .set({
      debugJson:
        params.debug === null
          ? null
          : safeJsonStringifyForLog(params.debug, {
              maxChars: 450_000,
              fallback: "{}",
            }),
    })
    .where(
      and(
        eq(llmGenerations.id, params.id),
        eq(llmGenerations.ownerId, resolveTrustedOwnerId())
      )
    );
}

export async function getLatestGenerationByChatBranchWithDebug(params: {
  chatId: string;
  branchId: string;
}): Promise<GenerationWithDebugDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(llmGenerations)
    .where(
      and(
        eq(llmGenerations.chatId, params.chatId),
        eq(llmGenerations.branchId, params.branchId),
        eq(llmGenerations.ownerId, resolveTrustedOwnerId())
      )
    )
    .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
    .limit(1);
  return rows[0] ? rowToWithDebugDto(rows[0]) : null;
}

