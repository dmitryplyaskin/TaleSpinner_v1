import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { pipelineRuns } from "../../db/schema";

export type PipelineRunStatus = "running" | "done" | "error" | "aborted";
export type PipelineRunTrigger = "user_message" | "manual" | "scheduled" | "api";

export type PipelineRunDto = {
  id: string;
  ownerId: string;
  chatId: string;
  entityProfileId: string;
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
    trigger: row.trigger,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    meta: safeJsonParse(row.metaJson, null),
  };
}

export async function createPipelineRun(params: {
  ownerId?: string;
  chatId: string;
  entityProfileId: string;
  trigger?: PipelineRunTrigger;
  meta?: unknown;
}): Promise<PipelineRunDto> {
  const db = await initDb();
  const id = uuidv4();
  const ts = new Date();

  await db.insert(pipelineRuns).values({
    id,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    entityProfileId: params.entityProfileId,
    trigger: params.trigger ?? "user_message",
    status: "running",
    startedAt: ts,
    finishedAt: null,
    metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
  });

  const rows = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, id));
  return rows[0] ? rowToDto(rows[0]) : {
    id,
    ownerId: params.ownerId ?? "global",
    chatId: params.chatId,
    entityProfileId: params.entityProfileId,
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

