import { randomUUID as uuidv4 } from "node:crypto";

import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { HttpError } from "../../core/middleware/error-handler";
import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { type DbExecutor, initDb } from "../../db/client";
import { chatBranches, chatEntries, chats, entryVariants } from "../../db/schema";

import { listPartsForVariants } from "./parts-repository";

import type { Entry, EntryRole, Variant, VariantKind } from "@shared/types/chat-entry-parts";

export type EntriesCursor = {
  createdAt: number;
  entryId: string;
};

export type EntriesPageInfo = {
  hasMoreOlder: boolean;
  nextCursor: EntriesCursor | null;
};

export type EntriesPageResult = {
  entries: Entry[];
  pageInfo: EntriesPageInfo;
};

function entryRowToDomain(row: typeof chatEntries.$inferSelect): Entry {
  return {
    entryId: row.entryId,
    chatId: row.chatId,
    branchId: row.branchId,
    role: row.role as EntryRole,
    createdAt: row.createdAt.getTime(),
    activeVariantId: row.activeVariantId,
    softDeleted: row.softDeleted ?? false,
    softDeletedAt: row.softDeletedAt ? row.softDeletedAt.getTime() : undefined,
    softDeletedBy: (row.softDeletedBy as any) ?? undefined,
    meta: safeJsonParse(row.metaJson, undefined) as any,
  };
}

function variantRowToDomain(
  row: typeof entryVariants.$inferSelect,
  parts: Variant["parts"]
): Variant {
  return {
    variantId: row.variantId,
    entryId: row.entryId,
    kind: row.kind as VariantKind,
    createdAt: row.createdAt.getTime(),
    parts,
    derived: safeJsonParse(row.derivedJson, undefined) as any,
  };
}

type CreateEntryWithVariantParams = {
  ownerId?: string;
  chatId: string;
  branchId: string;
  role: EntryRole;
  variantKind: VariantKind;
  meta?: unknown;
  executor?: DbExecutor;
};

export function createEntryWithVariant(
  params: CreateEntryWithVariantParams & { executor: DbExecutor }
): { entry: Entry; variant: Variant };
export function createEntryWithVariant(
  params: CreateEntryWithVariantParams
): Promise<{ entry: Entry; variant: Variant }>;
export function createEntryWithVariant(
  params: CreateEntryWithVariantParams
): Promise<{ entry: Entry; variant: Variant }> | { entry: Entry; variant: Variant } {
  const run = (db: DbExecutor): { entry: Entry; variant: Variant } => {
    const ownerId = resolveTrustedOwnerId(params.ownerId);
    const parent = db
      .select({ chatId: chats.id })
      .from(chats)
      .innerJoin(
        chatBranches,
        and(
          eq(chatBranches.id, params.branchId),
          eq(chatBranches.chatId, chats.id),
          eq(chatBranches.ownerId, ownerId)
        )
      )
      .where(and(eq(chats.id, params.chatId), eq(chats.ownerId, ownerId)))
      .limit(1)
      .get();
    if (!parent) {
      throw new HttpError(404, "Chat branch not found", "NOT_FOUND");
    }

    const entryId = uuidv4();
    const variantId = uuidv4();
    const createdAtMs = Date.now();
    const createdAt = new Date(createdAtMs);

    db.insert(chatEntries).values({
      entryId,
      ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      role: params.role,
      createdAt,
      activeVariantId: variantId,
      softDeleted: false,
      softDeletedAt: null,
      softDeletedBy: null,
      metaJson: typeof params.meta === "undefined" ? null : safeJsonStringify(params.meta),
    }).run();

    db.insert(entryVariants).values({
      variantId,
      ownerId,
      entryId,
      kind: params.variantKind,
      createdAt,
      derivedJson: null,
    }).run();

    const entry: Entry = {
      entryId,
      chatId: params.chatId,
      branchId: params.branchId,
      role: params.role,
      createdAt: createdAtMs,
      activeVariantId: variantId,
      softDeleted: false,
      meta: params.meta as any,
    };
    const variant: Variant = {
      variantId,
      entryId,
      kind: params.variantKind,
      createdAt: createdAtMs,
      parts: [],
    };

    return { entry, variant };
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function listEntriesPage(params: {
  chatId: string;
  branchId: string;
  limit: number;
  before?: number;
  cursorCreatedAt?: number;
  cursorEntryId?: string;
  includeSoftDeleted?: boolean;
}): Promise<EntriesPageResult> {
  const db = await initDb();
  const where = [
    eq(chatEntries.ownerId, resolveTrustedOwnerId()),
    eq(chatEntries.chatId, params.chatId),
    eq(chatEntries.branchId, params.branchId),
  ];
  if (!params.includeSoftDeleted) {
    where.push(eq(chatEntries.softDeleted, false));
  }

  const hasCursor =
    typeof params.cursorCreatedAt === "number" &&
    Number.isFinite(params.cursorCreatedAt) &&
    params.cursorCreatedAt > 0 &&
    typeof params.cursorEntryId === "string" &&
    params.cursorEntryId.length > 0;

  if (hasCursor) {
    const cursorDate = new Date(params.cursorCreatedAt!);
    where.push(
      or(
        lt(chatEntries.createdAt, cursorDate),
        and(eq(chatEntries.createdAt, cursorDate), lt(chatEntries.entryId, params.cursorEntryId!))
      )!
    );
  } else if (typeof params.before === "number") {
    where.push(lt(chatEntries.createdAt, new Date(params.before)));
  }

  const rowsNewestFirst = await db
    .select()
    .from(chatEntries)
    .where(and(...where))
    .orderBy(desc(chatEntries.createdAt), desc(chatEntries.entryId))
    .limit(params.limit + 1);

  const hasMoreOlder = rowsNewestFirst.length > params.limit;
  const pageRowsNewestFirst = hasMoreOlder ? rowsNewestFirst.slice(0, params.limit) : rowsNewestFirst;
  const entries = pageRowsNewestFirst.slice().reverse().map(entryRowToDomain);
  const oldest = entries[0];
  const nextCursor =
    hasMoreOlder && oldest
      ? {
          createdAt: oldest.createdAt,
          entryId: oldest.entryId,
        }
      : null;

  return {
    entries,
    pageInfo: {
      hasMoreOlder,
      nextCursor,
    },
  };
}

export async function listEntries(params: {
  chatId: string;
  branchId: string;
  limit: number;
  before?: number;
  cursorCreatedAt?: number;
  cursorEntryId?: string;
  includeSoftDeleted?: boolean;
}): Promise<Entry[]> {
  const page = await listEntriesPage(params);
  return page.entries;
}

export async function getEntryById(params: { entryId: string }): Promise<Entry | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(chatEntries)
    .where(
      and(
        eq(chatEntries.entryId, params.entryId),
        eq(chatEntries.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  const row = rows[0];
  return row ? entryRowToDomain(row) : null;
}

export async function getActiveVariantWithParts(params: {
  entry: Entry;
}): Promise<Variant | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(entryVariants)
    .where(
      and(
        eq(entryVariants.variantId, params.entry.activeVariantId),
        eq(entryVariants.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const partsMap = await listPartsForVariants({ variantIds: [row.variantId] });
  const parts = partsMap.get(row.variantId) ?? [];
  return variantRowToDomain(row, parts);
}

export async function listEntriesWithActiveVariants(params: {
  chatId: string;
  branchId: string;
  limit: number;
  before?: number;
  cursorCreatedAt?: number;
  cursorEntryId?: string;
  excludeEntryIds?: string[];
  includeSoftDeleted?: boolean;
}): Promise<Array<{ entry: Entry; variant: Variant | null }>> {
  const entries = await listEntries({
    chatId: params.chatId,
    branchId: params.branchId,
    limit: params.limit,
    before: params.before,
    cursorCreatedAt: params.cursorCreatedAt,
    cursorEntryId: params.cursorEntryId,
    includeSoftDeleted: params.includeSoftDeleted,
  });

  const exclude = new Set(params.excludeEntryIds ?? []);
  const filtered = entries.filter((e) => !exclude.has(e.entryId));
  const variantIds = filtered.map((e) => e.activeVariantId).filter(Boolean);

  if (variantIds.length === 0) {
    return filtered.map((entry) => ({ entry, variant: null }));
  }

  const db = await initDb();
  const variantRows = await db
    .select()
    .from(entryVariants)
    .where(
      and(
        inArray(entryVariants.variantId, variantIds),
        eq(entryVariants.ownerId, resolveTrustedOwnerId())
      )
    );

  const partsMap = await listPartsForVariants({ variantIds });

  const variantById = new Map<string, Variant>();
  for (const vr of variantRows) {
    const parts = partsMap.get(vr.variantId) ?? [];
    variantById.set(vr.variantId, variantRowToDomain(vr, parts));
  }

  return filtered.map((entry) => ({
    entry,
    variant: variantById.get(entry.activeVariantId) ?? null,
  }));
}

export async function listEntriesWithActiveVariantsPage(params: {
  chatId: string;
  branchId: string;
  limit: number;
  before?: number;
  cursorCreatedAt?: number;
  cursorEntryId?: string;
  excludeEntryIds?: string[];
  includeSoftDeleted?: boolean;
}): Promise<{
  entries: Array<{ entry: Entry; variant: Variant | null }>;
  pageInfo: EntriesPageInfo;
}> {
  const page = await listEntriesPage({
    chatId: params.chatId,
    branchId: params.branchId,
    limit: params.limit,
    before: params.before,
    cursorCreatedAt: params.cursorCreatedAt,
    cursorEntryId: params.cursorEntryId,
    includeSoftDeleted: params.includeSoftDeleted,
  });

  const exclude = new Set(params.excludeEntryIds ?? []);
  const filtered = page.entries.filter((entry) => !exclude.has(entry.entryId));
  const variantIds = filtered.map((entry) => entry.activeVariantId).filter(Boolean);

  if (variantIds.length === 0) {
    return {
      entries: filtered.map((entry) => ({ entry, variant: null })),
      pageInfo: page.pageInfo,
    };
  }

  const db = await initDb();
  const variantRows = await db
    .select()
    .from(entryVariants)
    .where(
      and(
        inArray(entryVariants.variantId, variantIds),
        eq(entryVariants.ownerId, resolveTrustedOwnerId())
      )
    );

  const partsMap = await listPartsForVariants({ variantIds });
  const variantById = new Map<string, Variant>();
  for (const variantRow of variantRows) {
    variantById.set(
      variantRow.variantId,
      variantRowToDomain(variantRow, partsMap.get(variantRow.variantId) ?? [])
    );
  }

  return {
    entries: filtered.map((entry) => ({
      entry,
      variant: variantById.get(entry.activeVariantId) ?? null,
    })),
    pageInfo: page.pageInfo,
  };
}

export async function getLatestSelectedPersonaIdForChatBranch(params: {
  chatId: string;
  branchId: string;
}): Promise<string | null> {
  const db = await initDb();
  const rows = await db
    .select({
      personaId: sql<string | null>`json_extract(${chatEntries.metaJson}, '$.personaSnapshot.id')`,
    })
    .from(chatEntries)
    .where(
      and(
        eq(chatEntries.ownerId, resolveTrustedOwnerId()),
        eq(chatEntries.chatId, params.chatId),
        eq(chatEntries.branchId, params.branchId),
        eq(chatEntries.role, "user"),
        eq(chatEntries.softDeleted, false),
        sql`json_type(${chatEntries.metaJson}, '$.personaSnapshot.id') = 'text'`
      )
    )
    .orderBy(desc(chatEntries.createdAt), desc(chatEntries.entryId))
    .limit(1);

  const personaId = rows[0]?.personaId;
  if (typeof personaId !== "string") return null;
  const trimmedPersonaId = personaId.trim();
  return trimmedPersonaId.length > 0 ? trimmedPersonaId : null;
}

export async function softDeleteEntry(params: { entryId: string; by: "user" | "agent" }): Promise<void> {
  const db = await initDb();
  await db
    .update(chatEntries)
    .set({
      softDeleted: true,
      softDeletedAt: new Date(),
      softDeletedBy: params.by,
    })
    .where(
      and(
        eq(chatEntries.entryId, params.entryId),
        eq(chatEntries.ownerId, resolveTrustedOwnerId())
      )
    );
}

export async function softDeleteEntries(params: {
  entryIds: string[];
  by: "user" | "agent";
}): Promise<string[]> {
  const db = await initDb();
  const dedupedEntryIds = Array.from(new Set(params.entryIds.map((id) => id.trim()).filter(Boolean)));
  if (dedupedEntryIds.length === 0) return [];

  const rows = await db
    .select({ entryId: chatEntries.entryId })
    .from(chatEntries)
    .where(
      and(
        inArray(chatEntries.entryId, dedupedEntryIds),
        eq(chatEntries.ownerId, resolveTrustedOwnerId())
      )
    );

  const foundEntryIds = rows.map((row) => row.entryId);
  if (foundEntryIds.length === 0) return [];

  await db
    .update(chatEntries)
    .set({
      softDeleted: true,
      softDeletedAt: new Date(),
      softDeletedBy: params.by,
    })
    .where(
      and(
        inArray(chatEntries.entryId, foundEntryIds),
        eq(chatEntries.ownerId, resolveTrustedOwnerId())
      )
    );

  return foundEntryIds;
}

type UpdateEntryMetaParams = {
  entryId: string;
  meta: unknown | null;
  executor?: DbExecutor;
};

export function updateEntryMeta(params: UpdateEntryMetaParams & { executor: DbExecutor }): void;
export function updateEntryMeta(params: UpdateEntryMetaParams): Promise<void>;
export function updateEntryMeta(params: UpdateEntryMetaParams): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    db
      .update(chatEntries)
      .set({
        metaJson: params.meta === null ? null : safeJsonStringify(params.meta),
      })
      .where(
        and(
          eq(chatEntries.entryId, params.entryId),
          eq(chatEntries.ownerId, resolveTrustedOwnerId())
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function hasActiveUserEntriesInBranch(params: {
  chatId: string;
  branchId: string;
}): Promise<boolean> {
  const db = await initDb();
  const rows = await db
    .select({ entryId: chatEntries.entryId })
    .from(chatEntries)
    .where(
      and(
        eq(chatEntries.ownerId, resolveTrustedOwnerId()),
        eq(chatEntries.chatId, params.chatId),
        eq(chatEntries.branchId, params.branchId),
        eq(chatEntries.role, "user"),
        eq(chatEntries.softDeleted, false)
      )
    )
    .limit(1);
  return rows.length > 0;
}

