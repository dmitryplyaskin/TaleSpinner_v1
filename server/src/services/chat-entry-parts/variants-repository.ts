import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chatEntries, entryVariants } from "../../db/schema";

import { listPartsForVariants } from "./parts-repository";

import type { Variant, VariantKind } from "@shared/types/chat-entry-parts";

function variantRowToDomain(row: typeof entryVariants.$inferSelect, parts: Variant["parts"]): Variant {
  return {
    variantId: row.variantId,
    entryId: row.entryId,
    kind: row.kind as VariantKind,
    createdAt: row.createdAt.getTime(),
    parts,
    derived: safeJsonParse(row.derivedJson, undefined) as any,
  };
}

export async function createVariant(params: {
  ownerId?: string;
  entryId: string;
  kind: VariantKind;
  derived?: unknown;
}): Promise<Variant> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";

  const variantId = uuidv4();
  const createdAtMs = Date.now();
  const createdAt = new Date(createdAtMs);

  await db.insert(entryVariants).values({
    variantId,
    ownerId,
    entryId: params.entryId,
    kind: params.kind,
    createdAt,
    derivedJson: typeof params.derived === "undefined" ? null : safeJsonStringify(params.derived),
  });

  return {
    variantId,
    entryId: params.entryId,
    kind: params.kind,
    createdAt: createdAtMs,
    parts: [],
    derived: params.derived as any,
  };
}

export async function listVariantsByIds(params: { variantIds: string[] }): Promise<Map<string, Variant>> {
  if (params.variantIds.length === 0) return new Map();
  const db = await initDb();
  const rows = await db
    .select()
    .from(entryVariants)
    .where(inArray(entryVariants.variantId, params.variantIds));

  const map = new Map<string, Variant>();
  for (const r of rows) {
    map.set(r.variantId, variantRowToDomain(r, []));
  }
  return map;
}

export async function selectActiveVariant(params: {
  entryId: string;
  variantId: string;
}): Promise<void> {
  const db = await initDb();
  await db
    .update(chatEntries)
    .set({ activeVariantId: params.variantId })
    .where(eq(chatEntries.entryId, params.entryId));
}

export async function listEntryVariants(params: { entryId: string }): Promise<Variant[]> {
  const db = await initDb();
  const rows = await db.select().from(entryVariants).where(eq(entryVariants.entryId, params.entryId));
  const variantIds = rows.map((r) => r.variantId);
  const partsMap = await listPartsForVariants({ variantIds });
  return rows
    .map((r) => variantRowToDomain(r, partsMap.get(r.variantId) ?? []))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export async function updateVariantDerived(params: {
  variantId: string;
  derived: unknown | null;
}): Promise<void> {
  const db = await initDb();
  await db
    .update(entryVariants)
    .set({ derivedJson: params.derived === null ? null : safeJsonStringify(params.derived) })
    .where(eq(entryVariants.variantId, params.variantId));
}

export async function getVariantById(params: { variantId: string }): Promise<Variant | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(entryVariants)
    .where(eq(entryVariants.variantId, params.variantId))
    .limit(1);
  const row = rows[0];
  return row ? variantRowToDomain(row, []) : null;
}

export async function deleteVariant(params: {
  entryId: string;
  variantId: string;
}): Promise<{ entryId: string; activeVariantId: string; deletedVariantId: string }> {
  const db = await initDb();

  const entryRows = await db
    .select({ activeVariantId: chatEntries.activeVariantId })
    .from(chatEntries)
    .where(eq(chatEntries.entryId, params.entryId))
    .limit(1);
  const entryRow = entryRows[0];
  if (!entryRow) throw new Error("Entry не найден");

  const variantRows = await db
    .select({ variantId: entryVariants.variantId, createdAt: entryVariants.createdAt })
    .from(entryVariants)
    .where(eq(entryVariants.entryId, params.entryId));

  const variantsSorted = variantRows
    .slice()
    .sort((a, b) => {
      const ts = a.createdAt.getTime() - b.createdAt.getTime();
      if (ts !== 0) return ts;
      if (a.variantId < b.variantId) return -1;
      if (a.variantId > b.variantId) return 1;
      return 0;
    });

  if (variantsSorted.length <= 1) {
    throw new Error("Нельзя удалить последний вариант");
  }

  const idx = variantsSorted.findIndex((v) => v.variantId === params.variantId);
  if (idx < 0) throw new Error("Variant не найден");

  const fallback = variantsSorted[idx - 1] ?? variantsSorted[idx + 1];
  if (!fallback) throw new Error("Не найден fallback вариант");

  const shouldSwitchActive = entryRow.activeVariantId === params.variantId;
  const nextActiveVariantId = shouldSwitchActive ? fallback.variantId : entryRow.activeVariantId;

  if (shouldSwitchActive) {
    await db
      .update(chatEntries)
      .set({ activeVariantId: nextActiveVariantId })
      .where(eq(chatEntries.entryId, params.entryId));
  }

  await db
    .delete(entryVariants)
    .where(and(eq(entryVariants.entryId, params.entryId), eq(entryVariants.variantId, params.variantId)));

  return {
    entryId: params.entryId,
    activeVariantId: nextActiveVariantId,
    deletedVariantId: params.variantId,
  };
}

