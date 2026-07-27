import { randomUUID as uuidv4 } from "node:crypto";

import { and, eq, isNull, or } from "drizzle-orm";

import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { initDb } from "../../db/client";
import { chatBranches, chats, knowledgeCollections } from "../../db/schema";

import { listKnowledgeRecordAccessState, upsertKnowledgeAccessState } from "./knowledge-access-repository";
import {
  encodeJson,
  rowToKnowledgeCollectionDto,
} from "./knowledge-helpers";
import { createKnowledgeRecordLinksBulk, listKnowledgeRecordLinks } from "./knowledge-links-repository";
import { listKnowledgeRecords, upsertKnowledgeRecord } from "./knowledge-records-repository";

import type {
  KnowledgeCollectionDto,
  KnowledgeCollectionExportPayload,
  KnowledgeCollectionImportResult,
  KnowledgeExportMode,
  KnowledgeLayer,
  KnowledgeOrigin,
  KnowledgeScope,
} from "@shared/types/chat-knowledge";

function shouldIncludeRecordForExport(
  mode: KnowledgeExportMode,
  layer: KnowledgeLayer
): boolean {
  if (mode === "baseline_plus_runtime") return true;
  if (mode === "baseline_only" || mode === "baseline_with_reveals") return layer === "baseline";
  return layer === "runtime";
}

export async function createKnowledgeCollection(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  scope: KnowledgeScope;
  name: string;
  kind?: string | null;
  description?: string | null;
  status?: "active" | "archived" | "deleted";
  origin: KnowledgeOrigin;
  layer: KnowledgeLayer;
  meta?: unknown;
}): Promise<KnowledgeCollectionDto> {
  const db = await initDb();
  const id = uuidv4();
  const now = new Date();
  const ownerId = resolveTrustedOwnerId(params.ownerId);
  const chat = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, params.chatId), eq(chats.ownerId, ownerId)))
    .limit(1);
  if (!chat[0]) throw new Error("Chat not found");
  if (params.branchId) {
    const branch = await db
      .select({ id: chatBranches.id })
      .from(chatBranches)
      .where(
        and(
          eq(chatBranches.id, params.branchId),
          eq(chatBranches.chatId, params.chatId),
          eq(chatBranches.ownerId, ownerId)
        )
      )
      .limit(1);
    if (!branch[0]) throw new Error("Chat branch not found");
  }
  await db.insert(knowledgeCollections).values({
    id,
    ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    scope: params.scope,
    name: params.name,
    kind: params.kind ?? null,
    description: params.description ?? null,
    status: params.status ?? "active",
    origin: params.origin,
    layer: params.layer,
    metaJson: typeof params.meta === "undefined" ? null : encodeJson(params.meta, "null"),
    createdAt: now,
    updatedAt: now,
  });
  const created = await getKnowledgeCollectionById(id);
  if (!created) throw new Error("Failed to create knowledge collection");
  return created;
}

export async function getKnowledgeCollectionById(
  id: string
): Promise<KnowledgeCollectionDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeCollections)
    .where(
      and(
        eq(knowledgeCollections.id, id),
        eq(knowledgeCollections.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  return rows[0] ? rowToKnowledgeCollectionDto(rows[0]) : null;
}

export async function listKnowledgeCollections(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
}): Promise<KnowledgeCollectionDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(knowledgeCollections)
    .where(
      and(
        eq(knowledgeCollections.ownerId, resolveTrustedOwnerId(params.ownerId)),
        eq(knowledgeCollections.chatId, params.chatId),
        params.branchId === null
          ? isNull(knowledgeCollections.branchId)
          : or(
              isNull(knowledgeCollections.branchId),
              eq(knowledgeCollections.branchId, params.branchId)
            )
      )
    );
  return rows.map(rowToKnowledgeCollectionDto);
}

export async function exportKnowledgeCollection(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  collectionId: string;
  mode: KnowledgeExportMode;
}): Promise<KnowledgeCollectionExportPayload> {
  const collection = await getKnowledgeCollectionById(params.collectionId);
  if (
    !collection ||
    collection.chatId !== params.chatId ||
    (collection.branchId !== null && collection.branchId !== params.branchId)
  ) {
    throw new Error("Knowledge collection not found");
  }

  const records = (await listKnowledgeRecords({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    collectionId: params.collectionId,
  })).filter((item) => shouldIncludeRecordForExport(params.mode, item.layer));

  const recordIds = new Set(records.map((item) => item.id));
  const links = (await listKnowledgeRecordLinks({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
  })).filter((item) => recordIds.has(item.fromRecordId) && recordIds.has(item.toRecordId));

  const accessState =
    params.mode === "baseline_with_reveals" ||
    params.mode === "runtime_only" ||
    params.mode === "baseline_plus_runtime"
      ? (await listKnowledgeRecordAccessState({
          ownerId: params.ownerId,
          chatId: params.chatId,
          branchId: params.branchId,
        })).filter((item) => recordIds.has(item.recordId))
      : [];

  return {
    version: 1,
    collection: {
      ownerId: collection.ownerId,
      chatId: collection.chatId,
      branchId: collection.branchId,
      scope: collection.scope,
      name: collection.name,
      kind: collection.kind,
      description: collection.description,
      status: collection.status,
      origin: collection.origin,
      layer: collection.layer,
      meta: collection.meta,
      sourceCollectionId: collection.id,
    },
    records,
    links,
    accessState,
    mode: params.mode,
  };
}

export async function importKnowledgeCollection(params: {
  ownerId?: string;
  chatId: string;
  branchId: string | null;
  payload: KnowledgeCollectionExportPayload;
}): Promise<KnowledgeCollectionImportResult> {
  const collection = await createKnowledgeCollection({
    ownerId: resolveTrustedOwnerId(
      params.ownerId ?? params.payload.collection.ownerId
    ),
    chatId: params.chatId,
    branchId: params.branchId,
    scope: params.payload.collection.scope,
    name: params.payload.collection.name,
    kind: params.payload.collection.kind,
    description: params.payload.collection.description,
    status: params.payload.collection.status,
    origin: params.payload.collection.origin,
    layer: params.payload.collection.layer,
    meta: params.payload.collection.meta,
  });

  const idMap = new Map<string, string>();
  const importedRecords = [];
  for (const item of params.payload.records) {
    const created = await upsertKnowledgeRecord({
      ownerId: resolveTrustedOwnerId(params.ownerId ?? item.ownerId),
      chatId: params.chatId,
      branchId: params.branchId,
      collectionId: collection.id,
      recordType: item.recordType,
      key: item.key,
      title: item.title,
      aliases: item.aliases,
      tags: item.tags,
      summary: item.summary,
      content: item.content,
      accessMode: item.accessMode,
      origin: item.origin,
      layer: item.layer,
      derivedFromRecordId: null,
      sourceMessageId: item.sourceMessageId,
      sourceOperationId: item.sourceOperationId,
      status: item.status,
      gatePolicy: item.gatePolicy,
      meta: item.meta,
    });
    idMap.set(item.id, created.id);
    importedRecords.push(created);
  }

  const importedLinks = await createKnowledgeRecordLinksBulk({
    ownerId: resolveTrustedOwnerId(params.ownerId),
    chatId: params.chatId,
    branchId: params.branchId,
    items: params.payload.links
      .map((item) => ({
        fromRecordId: idMap.get(item.fromRecordId) ?? "",
        relationType: item.relationType,
        toRecordId: idMap.get(item.toRecordId) ?? "",
        meta: item.meta,
      }))
      .filter((item) => item.fromRecordId.length > 0 && item.toRecordId.length > 0),
  });

  const importedAccessState = [];
  for (const item of params.payload.accessState) {
    const nextRecordId = idMap.get(item.recordId);
    if (!nextRecordId) continue;
    importedAccessState.push(
      await upsertKnowledgeAccessState({
        ownerId: resolveTrustedOwnerId(params.ownerId ?? item.ownerId),
        chatId: params.chatId,
        branchId: params.branchId,
        recordId: nextRecordId,
        discoverState: item.discoverState,
        readState: item.readState,
        promptState: item.promptState,
        revealState: item.revealState,
        revealedAt: item.revealedAt,
        revealedBy: item.revealedBy,
        revealReason: item.revealReason,
        flags: item.flags,
      })
    );
  }

  return {
    collection,
    records: importedRecords,
    links: importedLinks,
    accessState: importedAccessState,
  };
}
