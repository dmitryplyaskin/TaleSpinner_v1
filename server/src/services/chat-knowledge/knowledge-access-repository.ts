import { randomUUID as uuidv4 } from "node:crypto";

import { and, eq, isNull, or } from "drizzle-orm";

import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { initDb } from "../../db/client";
import { knowledgeRecordAccessState, knowledgeRecords } from "../../db/schema";

import {
  encodeJson,
  rowToKnowledgeRecordAccessStateDto,
} from "./knowledge-helpers";

import type {
  KnowledgeDiscoverState,
  KnowledgePromptState,
  KnowledgeReadState,
  KnowledgeRecordAccessStateDto,
  KnowledgeRevealActor,
  KnowledgeRevealState,
} from "@shared/types/chat-knowledge";

export async function listKnowledgeRecordAccessState(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
}): Promise<KnowledgeRecordAccessStateDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeRecordAccessState)
    .where(
      and(
        eq(
          knowledgeRecordAccessState.ownerId,
          resolveTrustedOwnerId(params.ownerId)
        ),
        eq(knowledgeRecordAccessState.chatId, params.chatId),
        or(
          params.branchId === null
            ? isNull(knowledgeRecordAccessState.branchId)
            : eq(knowledgeRecordAccessState.branchId, params.branchId),
          isNull(knowledgeRecordAccessState.branchId)
        )
      )
    );
  return rows.map(rowToKnowledgeRecordAccessStateDto);
}

export async function getKnowledgeRecordAccessState(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  recordId: string;
}): Promise<KnowledgeRecordAccessStateDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeRecordAccessState)
    .where(
      and(
        eq(
          knowledgeRecordAccessState.ownerId,
          resolveTrustedOwnerId(params.ownerId)
        ),
        eq(knowledgeRecordAccessState.chatId, params.chatId),
        params.branchId === null
          ? isNull(knowledgeRecordAccessState.branchId)
          : eq(knowledgeRecordAccessState.branchId, params.branchId),
        eq(knowledgeRecordAccessState.recordId, params.recordId)
      )
    )
    .limit(1);
  return rows[0] ? rowToKnowledgeRecordAccessStateDto(rows[0]) : null;
}

export async function upsertKnowledgeAccessState(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  recordId: string;
  discoverState: KnowledgeDiscoverState;
  readState: KnowledgeReadState;
  promptState: KnowledgePromptState;
  revealState: KnowledgeRevealState;
  revealedAt?: Date | null;
  revealedBy?: KnowledgeRevealActor | null;
  revealReason?: string | null;
  flags?: Record<string, unknown>;
}): Promise<KnowledgeRecordAccessStateDto> {
  const db = await initDb();
  const now = new Date();
  const ownerId = resolveTrustedOwnerId(params.ownerId);
  const record = await db
    .select({ id: knowledgeRecords.id })
    .from(knowledgeRecords)
    .where(
      and(
        eq(knowledgeRecords.id, params.recordId),
        eq(knowledgeRecords.ownerId, ownerId),
        eq(knowledgeRecords.chatId, params.chatId)
      )
    )
    .limit(1);
  if (!record[0]) throw new Error("Knowledge record not found");
  await db
    .insert(knowledgeRecordAccessState)
    .values({
      id: uuidv4(),
      ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      recordId: params.recordId,
      discoverState: params.discoverState,
      readState: params.readState,
      promptState: params.promptState,
      revealState: params.revealState,
      revealedAt: params.revealedAt ?? null,
      revealedBy: params.revealedBy ?? null,
      revealReason: params.revealReason ?? null,
      flagsJson: encodeJson(params.flags ?? {}, "{}"),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        knowledgeRecordAccessState.chatId,
        knowledgeRecordAccessState.branchId,
        knowledgeRecordAccessState.recordId,
      ],
      set: {
        discoverState: params.discoverState,
        readState: params.readState,
        promptState: params.promptState,
        revealState: params.revealState,
        revealedAt: params.revealedAt ?? null,
        revealedBy: params.revealedBy ?? null,
        revealReason: params.revealReason ?? null,
        flagsJson: encodeJson(params.flags ?? {}, "{}"),
        updatedAt: now,
      },
    });

  const reloaded = await getKnowledgeRecordAccessState({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    recordId: params.recordId,
  });
  if (!reloaded) {
    throw new Error("Failed to upsert knowledge access state");
  }
  return reloaded;
}
