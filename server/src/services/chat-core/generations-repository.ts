import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { llmGenerations } from "../../db/schema";

export type GenerationStatus = "streaming" | "done" | "aborted" | "error";

export type CreateGenerationParams = {
  ownerId?: string;
  chatId: string;
  messageId: string; // assistant message id
  variantId: string | null;
  pipelineRunId?: string | null;
  pipelineStepRunId?: string | null;
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
    messageId: params.messageId,
    variantId: params.variantId,
    pipelineRunId: params.pipelineRunId ?? null,
    pipelineStepRunId: params.pipelineStepRunId ?? null,
    providerId: params.providerId,
    model: params.model,
    paramsJson: safeJsonStringify(params.settings ?? {}, "{}"),
    status: "streaming",
    startedAt: ts,
    finishedAt: null,
    promptHash: null,
    promptSnapshotJson: null,
    promptTokens: null,
    completionTokens: null,
    error: null,
  });

  return { id, startedAt: ts };
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

