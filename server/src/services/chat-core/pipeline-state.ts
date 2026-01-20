import { and, desc, eq } from "drizzle-orm";

import { initDb } from "../../db/client";
import { llmGenerations, pipelineRuns, pipelineStepRuns } from "../../db/schema";

export type PipelineStateRunDto = {
  id: string;
  trigger: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  branchId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  assistantVariantId: string | null;
  generationId: string | null;
};

export type PipelineStateStepDto = {
  id: string;
  runId: string;
  stepName: string;
  stepType: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
};

export type PipelineStateGenerationDto = {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  branchId: string | null;
  messageId: string;
  variantId: string | null;
  pipelineRunId: string | null;
  pipelineStepRunId: string | null;
  error: string | null;
};

export type ChatPipelineStateDto = {
  chatId: string;
  // Best-effort current state. All sub-objects can be null (no runs yet).
  run: PipelineStateRunDto | null;
  step: PipelineStateStepDto | null;
  generation: PipelineStateGenerationDto | null;
};

function mapRun(r: typeof pipelineRuns.$inferSelect): PipelineStateRunDto {
  return {
    id: r.id,
    trigger: r.trigger,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    branchId: r.branchId ?? null,
    userMessageId: r.userMessageId ?? null,
    assistantMessageId: r.assistantMessageId ?? null,
    assistantVariantId: r.assistantVariantId ?? null,
    generationId: r.generationId ?? null,
  };
}

function mapStep(r: typeof pipelineStepRuns.$inferSelect): PipelineStateStepDto {
  return {
    id: r.id,
    runId: r.runId,
    stepName: r.stepName,
    stepType: r.stepType,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    error: r.error ?? null,
  };
}

function mapGen(r: typeof llmGenerations.$inferSelect): PipelineStateGenerationDto {
  return {
    id: r.id,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    branchId: r.branchId ?? null,
    messageId: r.messageId,
    variantId: r.variantId ?? null,
    pipelineRunId: r.pipelineRunId ?? null,
    pipelineStepRunId: r.pipelineStepRunId ?? null,
    error: r.error ?? null,
  };
}

export async function getChatPipelineState(params: {
  chatId: string;
  branchId?: string;
}): Promise<ChatPipelineStateDto> {
  const db = await initDb();
  const chatId = params.chatId;
  const branchId = typeof params.branchId === "string" && params.branchId.trim()
    ? params.branchId.trim()
    : null;

  // 1) Prefer an active streaming generation (best for SSE recovery).
  const activeGenRows = await db
    .select()
    .from(llmGenerations)
    .where(
      and(
        eq(llmGenerations.chatId, chatId),
        ...(branchId ? [eq(llmGenerations.branchId, branchId)] : []),
        eq(llmGenerations.status, "streaming")
      )
    )
    .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
    .limit(1);

  const activeGen = activeGenRows[0] ?? null;
  if (activeGen) {
    const runId = activeGen.pipelineRunId ?? null;
    const stepId = activeGen.pipelineStepRunId ?? null;

    const [runRows, stepRows] = await Promise.all([
      runId
        ? db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId)).limit(1)
        : Promise.resolve([]),
      stepId
        ? db.select().from(pipelineStepRuns).where(eq(pipelineStepRuns.id, stepId)).limit(1)
        : Promise.resolve([]),
    ]);

    return {
      chatId,
      run: runRows[0] ? mapRun(runRows[0]) : null,
      step: stepRows[0] ? mapStep(stepRows[0]) : null,
      generation: mapGen(activeGen),
    };
  }

  // 2) Otherwise, try the latest running pipeline run.
  const runningRunRows = await db
    .select()
    .from(pipelineRuns)
    .where(
      and(
        eq(pipelineRuns.chatId, chatId),
        ...(branchId ? [eq(pipelineRuns.branchId, branchId)] : []),
        eq(pipelineRuns.status, "running")
      )
    )
    .orderBy(desc(pipelineRuns.startedAt), desc(pipelineRuns.id))
    .limit(1);
  const runningRun = runningRunRows[0] ?? null;

  if (runningRun) {
    const [stepRows, genRows] = await Promise.all([
      db
        .select()
        .from(pipelineStepRuns)
        .where(eq(pipelineStepRuns.runId, runningRun.id))
        .orderBy(desc(pipelineStepRuns.startedAt), desc(pipelineStepRuns.id))
        .limit(1),
      db
        .select()
        .from(llmGenerations)
        .where(eq(llmGenerations.pipelineRunId, runningRun.id))
        .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
        .limit(1),
    ]);

    return {
      chatId,
      run: mapRun(runningRun),
      step: stepRows[0] ? mapStep(stepRows[0]) : null,
      generation: genRows[0] ? mapGen(genRows[0]) : null,
    };
  }

  // 3) Fallback: latest generation in the chat (can be done/error/aborted).
  const lastGenRows = await db
    .select()
    .from(llmGenerations)
    .where(
      and(
        eq(llmGenerations.chatId, chatId),
        ...(branchId ? [eq(llmGenerations.branchId, branchId)] : [])
      )
    )
    .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
    .limit(1);
  const lastGen = lastGenRows[0] ?? null;

  if (lastGen) {
    const runId = lastGen.pipelineRunId ?? null;
    const stepId = lastGen.pipelineStepRunId ?? null;

    const [runRows, stepRows] = await Promise.all([
      runId
        ? db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId)).limit(1)
        : Promise.resolve([]),
      stepId
        ? db.select().from(pipelineStepRuns).where(eq(pipelineStepRuns.id, stepId)).limit(1)
        : Promise.resolve([]),
    ]);

    return {
      chatId,
      run: runRows[0] ? mapRun(runRows[0]) : null,
      step: stepRows[0] ? mapStep(stepRows[0]) : null,
      generation: mapGen(lastGen),
    };
  }

  return { chatId, run: null, step: null, generation: null };
}

