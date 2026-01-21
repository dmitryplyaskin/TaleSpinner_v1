import { and, asc, desc, eq } from "drizzle-orm";

import { safeJsonParse } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { llmGenerations, pipelineRuns, pipelineStepRuns } from "../../db/schema";
import { resolveActivePipelineProfile } from "./pipeline-profile-resolver";

export type PipelineDebugRunDto = {
  id: string;
  trigger: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  idempotencyKey: string | null;
  branchId: string | null;
  userMessageId: string | null;
  assistantMessageId: string | null;
  assistantVariantId: string | null;
  generationId: string | null;
  activeProfileId: string | null;
  activeProfileVersion: number | null;
  meta: unknown | null;
};

export type PipelineDebugStepDto = {
  id: string;
  runId: string;
  stepName: string;
  stepType: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  input: unknown | null;
  output: unknown | null;
  error: string | null;
};

export type PipelineDebugGenerationDto = {
  id: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  branchId: string | null;
  messageId: string;
  variantId: string | null;
  pipelineRunId: string | null;
  pipelineStepRunId: string | null;
  providerId: string;
  model: string;
  params: unknown;
  promptHash: string | null;
  promptSnapshot: unknown | null;
  error: string | null;
};

export type ChatPipelineDebugDto = {
  chatId: string;
  branchId: string | null;
  resolvedActiveProfile: Awaited<ReturnType<typeof resolveActivePipelineProfile>>;
  run: PipelineDebugRunDto | null;
  steps: PipelineDebugStepDto[];
  generation: PipelineDebugGenerationDto | null;
  report: {
    trigger: string | null;
    idempotencyKey: string | null;
    prompt: {
      promptHash: string | null;
      promptSnapshot: unknown | null;
      trimming: unknown | null;
      artifactInclusions: unknown[];
    };
    post: {
      stateWrites: unknown[];
    };
  };
};

function mapRun(r: typeof pipelineRuns.$inferSelect): PipelineDebugRunDto {
  return {
    id: r.id,
    trigger: r.trigger,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    idempotencyKey: r.idempotencyKey ?? null,
    branchId: r.branchId ?? null,
    userMessageId: r.userMessageId ?? null,
    assistantMessageId: r.assistantMessageId ?? null,
    assistantVariantId: r.assistantVariantId ?? null,
    generationId: r.generationId ?? null,
    activeProfileId: r.activeProfileId ?? null,
    activeProfileVersion: r.activeProfileVersion ?? null,
    meta: safeJsonParse(r.metaJson, null),
  };
}

function mapStep(r: typeof pipelineStepRuns.$inferSelect): PipelineDebugStepDto {
  return {
    id: r.id,
    runId: r.runId,
    stepName: r.stepName,
    stepType: r.stepType,
    status: r.status,
    startedAt: r.startedAt,
    finishedAt: r.finishedAt ?? null,
    input: safeJsonParse(r.inputJson, null),
    output: safeJsonParse(r.outputJson, null),
    error: r.error ?? null,
  };
}

function mapGen(r: typeof llmGenerations.$inferSelect): PipelineDebugGenerationDto {
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
    providerId: r.providerId,
    model: r.model,
    params: safeJsonParse(r.paramsJson, {}),
    promptHash: r.promptHash ?? null,
    promptSnapshot: safeJsonParse(r.promptSnapshotJson, null),
    error: r.error ?? null,
  };
}

export async function getChatPipelineDebug(params: {
  ownerId?: string;
  chatId: string;
  entityProfileId: string;
  branchId?: string;
}): Promise<ChatPipelineDebugDto> {
  const db = await initDb();
  const branchId =
    typeof params.branchId === "string" && params.branchId.trim()
      ? params.branchId.trim()
      : null;

  const resolvedActiveProfile = await resolveActivePipelineProfile({
    ownerId: params.ownerId,
    chatId: params.chatId,
    entityProfileId: params.entityProfileId,
  });

  // Prefer active streaming generation.
  const activeGenRows = await db
    .select()
    .from(llmGenerations)
    .where(
      and(
        eq(llmGenerations.chatId, params.chatId),
        ...(branchId ? [eq(llmGenerations.branchId, branchId)] : []),
        eq(llmGenerations.status, "streaming")
      )
    )
    .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
    .limit(1);
  const activeGen = activeGenRows[0] ?? null;

  const runId =
    activeGen?.pipelineRunId ??
    (await (async () => {
      const runRows = await db
        .select()
        .from(pipelineRuns)
        .where(
          and(
            eq(pipelineRuns.chatId, params.chatId),
            ...(branchId ? [eq(pipelineRuns.branchId, branchId)] : [])
          )
        )
        .orderBy(desc(pipelineRuns.startedAt), desc(pipelineRuns.id))
        .limit(1);
      return runRows[0]?.id ?? null;
    })());

  if (!runId) {
    return {
      chatId: params.chatId,
      branchId,
      resolvedActiveProfile,
      run: null,
      steps: [],
      generation: null,
      report: {
        trigger: null,
        idempotencyKey: null,
        prompt: { promptHash: null, promptSnapshot: null, trimming: null, artifactInclusions: [] },
        post: { stateWrites: [] },
      },
    };
  }

  const [runRows, stepRows, genRows] = await Promise.all([
    db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId)).limit(1),
    db
      .select()
      .from(pipelineStepRuns)
      .where(eq(pipelineStepRuns.runId, runId))
      .orderBy(asc(pipelineStepRuns.startedAt), asc(pipelineStepRuns.id)),
    db
      .select()
      .from(llmGenerations)
      .where(eq(llmGenerations.pipelineRunId, runId))
      .orderBy(desc(llmGenerations.startedAt), desc(llmGenerations.id))
      .limit(1),
  ]);

  const run = runRows[0] ? mapRun(runRows[0]) : null;
  const steps = stepRows.map(mapStep);
  const generation = genRows[0] ? mapGen(genRows[0]) : null;

  const pre = steps.find((s) => s.stepType === "pre") ?? null;
  const post = steps.find((s) => s.stepType === "post") ?? null;
  const preOut = pre?.output && typeof pre.output === "object" ? (pre.output as any) : null;
  const postOut = post?.output && typeof post.output === "object" ? (post.output as any) : null;

  const report = {
    trigger: run?.trigger ?? null,
    idempotencyKey: run?.idempotencyKey ?? null,
    prompt: {
      promptHash:
        (typeof preOut?.promptHash === "string" ? preOut.promptHash : null) ??
        (typeof generation?.promptHash === "string" ? generation.promptHash : null),
      promptSnapshot:
        (typeof preOut?.promptSnapshot !== "undefined" ? preOut.promptSnapshot : null) ??
        (generation?.promptSnapshot ?? null),
      trimming: typeof preOut?.trimming !== "undefined" ? preOut.trimming : null,
      artifactInclusions: Array.isArray(preOut?.artifactInclusions) ? preOut.artifactInclusions : [],
    },
    post: {
      stateWrites: Array.isArray(postOut?.stateWrites) ? postOut.stateWrites : [],
    },
  };

  return {
    chatId: params.chatId,
    branchId,
    resolvedActiveProfile,
    run,
    steps,
    generation,
    report,
  };
}

