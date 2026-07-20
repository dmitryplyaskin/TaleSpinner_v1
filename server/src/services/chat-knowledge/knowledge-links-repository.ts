import { randomUUID as uuidv4 } from "node:crypto";

import { and, eq, isNull, or } from "drizzle-orm";

import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { initDb } from "../../db/client";
import { knowledgeRecordLinks } from "../../db/schema";

import { encodeJson, rowToKnowledgeRecordLinkDto } from "./knowledge-helpers";

import type { KnowledgeRecordLinkDto } from "@shared/types/chat-knowledge";

export async function createKnowledgeRecordLinksBulk(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  items: Array<{
    fromRecordId: string;
    relationType: string;
    toRecordId: string;
    meta?: unknown;
  }>;
}): Promise<KnowledgeRecordLinkDto[]> {
  if (params.items.length === 0) return [];
  const db = await initDb();
  const now = new Date();
  await db
    .insert(knowledgeRecordLinks)
    .values(
      params.items.map((item) => ({
        id: uuidv4(),
        ownerId: resolveTrustedOwnerId(params.ownerId),
        chatId: params.chatId,
        branchId: params.branchId,
        fromRecordId: item.fromRecordId,
        relationType: item.relationType,
        toRecordId: item.toRecordId,
        metaJson: typeof item.meta === "undefined" ? null : encodeJson(item.meta, "null"),
        createdAt: now,
        updatedAt: now,
      }))
    )
    .onConflictDoNothing();
  return listKnowledgeRecordLinks({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
  });
}

export async function listKnowledgeRecordLinks(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
}): Promise<KnowledgeRecordLinkDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeRecordLinks)
    .where(
      and(
        eq(knowledgeRecordLinks.ownerId, resolveTrustedOwnerId(params.ownerId)),
        eq(knowledgeRecordLinks.chatId, params.chatId),
        or(
          params.branchId === null
            ? isNull(knowledgeRecordLinks.branchId)
            : eq(knowledgeRecordLinks.branchId, params.branchId),
          isNull(knowledgeRecordLinks.branchId)
        )
      )
    );
  return rows.map(rowToKnowledgeRecordLinkDto);
}
