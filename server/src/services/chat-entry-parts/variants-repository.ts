import { eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { chatEntries, entryVariants } from "../../db/schema";

import type { Variant, VariantKind } from "@shared/types/chat-entry-parts";
import { listPartsForVariants } from "./parts-repository";

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

