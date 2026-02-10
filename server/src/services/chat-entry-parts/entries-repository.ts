import { and, desc, eq, inArray, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chatEntries, entryVariants } from "../../db/schema";

import { listPartsForVariants } from "./parts-repository";

import type { Entry, EntryRole, Variant, VariantKind } from "@shared/types/chat-entry-parts";

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

export async function createEntryWithVariant(params: {
  ownerId?: string;
  chatId: string;
  branchId: string;
  role: EntryRole;
  variantKind: VariantKind;
  meta?: unknown;
}): Promise<{ entry: Entry; variant: Variant }> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";

  const entryId = uuidv4();
  const variantId = uuidv4();
  const createdAtMs = Date.now();
  const createdAt = new Date(createdAtMs);

  await db.insert(chatEntries).values({
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
  });

  await db.insert(entryVariants).values({
    variantId,
    ownerId,
    entryId,
    kind: params.variantKind,
    createdAt,
    derivedJson: null,
  });

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
}

export async function listEntries(params: {
  chatId: string;
  branchId: string;
  limit: number;
  before?: number;
  includeSoftDeleted?: boolean;
}): Promise<Entry[]> {
  const db = await initDb();
  const where = [eq(chatEntries.chatId, params.chatId), eq(chatEntries.branchId, params.branchId)];
  if (!params.includeSoftDeleted) {
    where.push(eq(chatEntries.softDeleted, false));
  }
  if (typeof params.before === "number") {
    where.push(lt(chatEntries.createdAt, new Date(params.before)));
  }

  const rowsNewestFirst = await db
    .select()
    .from(chatEntries)
    .where(and(...where))
    .orderBy(desc(chatEntries.createdAt), desc(chatEntries.entryId))
    .limit(params.limit);

  return rowsNewestFirst.slice().reverse().map(entryRowToDomain);
}

export async function getEntryById(params: { entryId: string }): Promise<Entry | null> {
  const db = await initDb();
  const rows = await db.select().from(chatEntries).where(eq(chatEntries.entryId, params.entryId)).limit(1);
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
    .where(eq(entryVariants.variantId, params.entry.activeVariantId))
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
  excludeEntryIds?: string[];
  includeSoftDeleted?: boolean;
}): Promise<Array<{ entry: Entry; variant: Variant | null }>> {
  const entries = await listEntries({
    chatId: params.chatId,
    branchId: params.branchId,
    limit: params.limit,
    before: params.before,
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
    .where(inArray(entryVariants.variantId, variantIds));

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

export async function softDeleteEntry(params: { entryId: string; by: "user" | "agent" }): Promise<void> {
  const db = await initDb();
  await db
    .update(chatEntries)
    .set({
      softDeleted: true,
      softDeletedAt: new Date(),
      softDeletedBy: params.by,
    })
    .where(eq(chatEntries.entryId, params.entryId));
}

export async function updateEntryMeta(params: {
  entryId: string;
  meta: unknown | null;
}): Promise<void> {
  const db = await initDb();
  await db
    .update(chatEntries)
    .set({
      metaJson: params.meta === null ? null : safeJsonStringify(params.meta),
    })
    .where(eq(chatEntries.entryId, params.entryId));
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
        eq(chatEntries.chatId, params.chatId),
        eq(chatEntries.branchId, params.branchId),
        eq(chatEntries.role, "user"),
        eq(chatEntries.softDeleted, false)
      )
    )
    .limit(1);
  return rows.length > 0;
}

