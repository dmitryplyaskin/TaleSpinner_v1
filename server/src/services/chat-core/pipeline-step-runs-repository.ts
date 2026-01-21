import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringifyForLog } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { pipelineStepRuns } from "../../db/schema";

export type PipelineStepType = "pre" | "rag" | "llm" | "post" | "tool";
export type PipelineStepStatus = "running" | "done" | "aborted" | "error" | "skipped";

export type PipelineStepRunDto = {
  id: string;
  ownerId: string;
  runId: string;
  stepName: string;
  stepType: PipelineStepType;
  status: PipelineStepStatus;
  startedAt: Date;
  finishedAt: Date | null;
  input: unknown | null;
  output: unknown | null;
  error: string | null;
};

function rowToDto(row: typeof pipelineStepRuns.$inferSelect): PipelineStepRunDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    runId: row.runId,
    stepName: row.stepName,
    stepType: row.stepType,
    status: row.status,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt ?? null,
    input: safeJsonParse(row.inputJson, null),
    output: safeJsonParse(row.outputJson, null),
    error: row.error ?? null,
  };
}

export async function createPipelineStepRun(params: {
  ownerId?: string;
  runId: string;
  stepName: string;
  stepType: PipelineStepType;
  input?: unknown;
  output?: unknown;
}): Promise<PipelineStepRunDto> {
  const db = await initDb();
  const id = uuidv4();
  const ts = new Date();

  await db.insert(pipelineStepRuns).values({
    id,
    ownerId: params.ownerId ?? "global",
    runId: params.runId,
    stepName: params.stepName,
    stepType: params.stepType,
    status: "running",
    startedAt: ts,
    finishedAt: null,
    inputJson:
      typeof params.input === "undefined"
        ? null
        : safeJsonStringifyForLog(params.input, { maxChars: 20_000, fallback: "{}" }),
    outputJson:
      typeof params.output === "undefined"
        ? null
        : safeJsonStringifyForLog(params.output, { maxChars: 20_000, fallback: "{}" }),
    error: null,
  });

  const rows = await db.select().from(pipelineStepRuns).where(eq(pipelineStepRuns.id, id));
  return rows[0] ? rowToDto(rows[0]) : {
    id,
    ownerId: params.ownerId ?? "global",
    runId: params.runId,
    stepName: params.stepName,
    stepType: params.stepType,
    status: "running",
    startedAt: ts,
    finishedAt: null,
    input: typeof params.input === "undefined" ? null : params.input,
    output: typeof params.output === "undefined" ? null : params.output,
    error: null,
  };
}

export async function finishPipelineStepRun(params: {
  id: string;
  status: Exclude<PipelineStepStatus, "running">;
  output?: unknown;
  error?: string | null;
}): Promise<void> {
  const db = await initDb();
  const ts = new Date();
  await db
    .update(pipelineStepRuns)
    .set({
      status: params.status,
      finishedAt: ts,
      outputJson:
        typeof params.output === "undefined"
          ? undefined
          : safeJsonStringifyForLog(params.output, { maxChars: 20_000, fallback: "{}" }),
      error: params.error ?? null,
    })
    .where(eq(pipelineStepRuns.id, params.id));
}

