import { randomUUID as uuidv4 } from "node:crypto";

import { and, eq, inArray, isNull, or } from "drizzle-orm";

import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { initDb } from "../../db/client";
import { knowledgeCollections, knowledgeRecords } from "../../db/schema";

import {
  buildKnowledgeSearchText,
  encodeJson,
  rowToKnowledgeRecordDto,
} from "./knowledge-helpers";

import type {
  KnowledgeAccessMode,
  KnowledgeGatePolicy,
  KnowledgeLayer,
  KnowledgeOrigin,
  KnowledgeRecordDto,
  KnowledgeRecordStatus,
} from "@shared/types/chat-knowledge";

function buildOverlayBranchScope(branchId: string | null) {
  return branchId === null
    ? isNull(knowledgeRecords.branchId)
    : or(isNull(knowledgeRecords.branchId), eq(knowledgeRecords.branchId, branchId));
}

function buildExactBranchScope(branchId: string | null) {
  return branchId === null
    ? isNull(knowledgeRecords.branchId)
    : eq(knowledgeRecords.branchId, branchId);
}

export async function getKnowledgeRecordById(
  id: string
): Promise<KnowledgeRecordDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeRecords)
    .where(
      and(
        eq(knowledgeRecords.id, id),
        eq(knowledgeRecords.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  return rows[0] ? rowToKnowledgeRecordDto(rows[0]) : null;
}

export async function getKnowledgeRecordsByIds(ids: string[]): Promise<KnowledgeRecordDto[]> {
  if (ids.length === 0) return [];
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeRecords)
    .where(
      and(
        inArray(knowledgeRecords.id, ids),
        eq(knowledgeRecords.ownerId, resolveTrustedOwnerId())
      )
    );
  return rows.map(rowToKnowledgeRecordDto);
}

export async function getScopedKnowledgeRecordsByIds(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  ids: string[];
}): Promise<KnowledgeRecordDto[]> {
  if (params.ids.length === 0) return [];
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeRecords)
    .where(
      and(
        eq(knowledgeRecords.ownerId, resolveTrustedOwnerId(params.ownerId)),
        eq(knowledgeRecords.chatId, params.chatId),
        buildOverlayBranchScope(params.branchId),
        inArray(knowledgeRecords.id, params.ids)
      )
    );
  return rows.map(rowToKnowledgeRecordDto);
}

export async function findKnowledgeRecordsByKeys(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  keys: string[];
}): Promise<KnowledgeRecordDto[]> {
  if (params.keys.length === 0) return [];
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeRecords)
    .where(
      and(
        eq(knowledgeRecords.ownerId, resolveTrustedOwnerId(params.ownerId)),
        eq(knowledgeRecords.chatId, params.chatId),
        buildOverlayBranchScope(params.branchId),
        inArray(knowledgeRecords.key, params.keys)
      )
    );
  return rows.map(rowToKnowledgeRecordDto);
}

export async function listKnowledgeRecords(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  collectionId?: string;
  includeArchived?: boolean;
}): Promise<KnowledgeRecordDto[]> {
  const db = await initDb();
  const where = [
    eq(knowledgeRecords.ownerId, resolveTrustedOwnerId(params.ownerId)),
    eq(knowledgeRecords.chatId, params.chatId),
    buildOverlayBranchScope(params.branchId),
  ];
  if (params.collectionId) where.push(eq(knowledgeRecords.collectionId, params.collectionId));
  if (!params.includeArchived) where.push(eq(knowledgeRecords.status, "active"));
  const rows = await db.select().from(knowledgeRecords).where(and(...where));
  return rows.map(rowToKnowledgeRecordDto);
}

export async function upsertKnowledgeRecord(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  collectionId: string;
  recordType: string;
  key: string;
  title: string;
  aliases: string[];
  tags: string[];
  summary?: string | null;
  content: unknown;
  accessMode: KnowledgeAccessMode;
  origin: KnowledgeOrigin;
  layer: KnowledgeLayer;
  derivedFromRecordId?: string | null;
  sourceMessageId?: string | null;
  sourceOperationId?: string | null;
  status?: KnowledgeRecordStatus;
  gatePolicy?: KnowledgeGatePolicy | null;
  meta?: unknown;
}): Promise<KnowledgeRecordDto> {
  const db = await initDb();
  const now = new Date();
  const ownerId = resolveTrustedOwnerId(params.ownerId);
  const collection = await db
    .select({ id: knowledgeCollections.id })
    .from(knowledgeCollections)
    .where(
      and(
        eq(knowledgeCollections.id, params.collectionId),
        eq(knowledgeCollections.ownerId, ownerId),
        eq(knowledgeCollections.chatId, params.chatId),
        params.branchId === null
          ? isNull(knowledgeCollections.branchId)
          : or(
              isNull(knowledgeCollections.branchId),
              eq(knowledgeCollections.branchId, params.branchId)
            )
      )
    )
    .limit(1);
  if (!collection[0]) throw new Error("Knowledge collection not found");

  const searchText = buildKnowledgeSearchText({
    title: params.title,
    aliases: params.aliases,
    tags: params.tags,
    summary: params.summary ?? null,
    content: params.content,
    accessMode: params.accessMode,
  });
  const rows = await db
    .select()
    .from(knowledgeRecords)
    .where(
      and(
        eq(knowledgeRecords.ownerId, ownerId),
        eq(knowledgeRecords.chatId, params.chatId),
        buildExactBranchScope(params.branchId),
        eq(knowledgeRecords.collectionId, params.collectionId),
        eq(knowledgeRecords.key, params.key)
      )
    )
    .limit(1);
  const current = rows[0];

  if (current) {
    await db
      .update(knowledgeRecords)
      .set({
        recordType: params.recordType,
        title: params.title,
        aliasesJson: encodeJson(params.aliases, "[]"),
        tagsJson: encodeJson(params.tags, "[]"),
        summary: params.summary ?? null,
        contentJson: encodeJson(params.content, "null"),
        searchText,
        accessMode: params.accessMode,
        origin: params.origin,
        layer: params.layer,
        derivedFromRecordId: params.derivedFromRecordId ?? null,
        sourceMessageId: params.sourceMessageId ?? null,
        sourceOperationId: params.sourceOperationId ?? null,
        status: params.status ?? "active",
        gatePolicyJson:
          typeof params.gatePolicy === "undefined" ? null : encodeJson(params.gatePolicy, "null"),
        metaJson: typeof params.meta === "undefined" ? null : encodeJson(params.meta, "null"),
        updatedAt: now,
      })
      .where(
        and(
          eq(knowledgeRecords.id, current.id),
          eq(knowledgeRecords.ownerId, ownerId)
        )
      );
  } else {
    await db.insert(knowledgeRecords).values({
      id: uuidv4(),
      ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      collectionId: params.collectionId,
      recordType: params.recordType,
      key: params.key,
      title: params.title,
      aliasesJson: encodeJson(params.aliases, "[]"),
      tagsJson: encodeJson(params.tags, "[]"),
      summary: params.summary ?? null,
      contentJson: encodeJson(params.content, "null"),
      searchText,
      accessMode: params.accessMode,
      origin: params.origin,
      layer: params.layer,
      derivedFromRecordId: params.derivedFromRecordId ?? null,
      sourceMessageId: params.sourceMessageId ?? null,
      sourceOperationId: params.sourceOperationId ?? null,
      status: params.status ?? "active",
      gatePolicyJson:
        typeof params.gatePolicy === "undefined" ? null : encodeJson(params.gatePolicy, "null"),
      metaJson: typeof params.meta === "undefined" ? null : encodeJson(params.meta, "null"),
      createdAt: now,
      updatedAt: now,
    });
  }

  const reloadedRows = await db
    .select()
    .from(knowledgeRecords)
    .where(
      and(
        eq(knowledgeRecords.ownerId, ownerId),
        eq(knowledgeRecords.chatId, params.chatId),
        buildExactBranchScope(params.branchId),
        eq(knowledgeRecords.collectionId, params.collectionId),
        eq(knowledgeRecords.key, params.key)
      )
    )
    .limit(1);
  if (!reloadedRows[0]) {
    throw new Error("Failed to upsert knowledge record");
  }
  return rowToKnowledgeRecordDto(reloadedRows[0]);
}
