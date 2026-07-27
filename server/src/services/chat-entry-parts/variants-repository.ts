import { randomUUID as uuidv4 } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { HttpError } from "../../core/middleware/error-handler";
import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { type DbExecutor, initDb } from "../../db/client";
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

type CreateVariantParams = {
  ownerId?: string;
  entryId: string;
  kind: VariantKind;
  derived?: unknown;
  executor?: DbExecutor;
};

export function createVariant(params: CreateVariantParams & { executor: DbExecutor }): Variant;
export function createVariant(params: CreateVariantParams): Promise<Variant>;
export function createVariant(params: CreateVariantParams): Promise<Variant> | Variant {
  const run = (db: DbExecutor): Variant => {
    const ownerId = resolveTrustedOwnerId(params.ownerId);
    const parent = db
      .select({ entryId: chatEntries.entryId })
      .from(chatEntries)
      .where(
        and(
          eq(chatEntries.entryId, params.entryId),
          eq(chatEntries.ownerId, ownerId)
        )
      )
      .limit(1)
      .get();
    if (!parent) {
      throw new HttpError(404, "Chat entry not found", "NOT_FOUND");
    }

    const variantId = uuidv4();
    const createdAtMs = Date.now();
    const createdAt = new Date(createdAtMs);

    db.insert(entryVariants).values({
      variantId,
      ownerId,
      entryId: params.entryId,
      kind: params.kind,
      createdAt,
      derivedJson: typeof params.derived === "undefined" ? null : safeJsonStringify(params.derived),
    }).run();

    return {
      variantId,
      entryId: params.entryId,
      kind: params.kind,
      createdAt: createdAtMs,
      parts: [],
      derived: params.derived as any,
    };
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function listVariantsByIds(params: { variantIds: string[] }): Promise<Map<string, Variant>> {
  if (params.variantIds.length === 0) return new Map();
  const db = await initDb();
  const rows = await db
    .select()
    .from(entryVariants)
    .where(
      and(
        inArray(entryVariants.variantId, params.variantIds),
        eq(entryVariants.ownerId, resolveTrustedOwnerId())
      )
    );

  const map = new Map<string, Variant>();
  for (const r of rows) {
    map.set(r.variantId, variantRowToDomain(r, []));
  }
  return map;
}

type SelectActiveVariantParams = {
  entryId: string;
  variantId: string;
  executor?: DbExecutor;
};

export function selectActiveVariant(params: SelectActiveVariantParams & { executor: DbExecutor }): void;
export function selectActiveVariant(params: SelectActiveVariantParams): Promise<void>;
export function selectActiveVariant(params: SelectActiveVariantParams): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    const ownerId = resolveTrustedOwnerId();
    const variant = db
      .select({ variantId: entryVariants.variantId })
      .from(entryVariants)
      .where(
        and(
          eq(entryVariants.variantId, params.variantId),
          eq(entryVariants.entryId, params.entryId),
          eq(entryVariants.ownerId, ownerId)
        )
      )
      .limit(1)
      .get();
    if (!variant) {
      throw new HttpError(404, "Entry variant not found", "NOT_FOUND");
    }
    db
      .update(chatEntries)
      .set({ activeVariantId: params.variantId })
      .where(
        and(
          eq(chatEntries.entryId, params.entryId),
          eq(chatEntries.ownerId, ownerId)
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function listEntryVariants(params: { entryId: string }): Promise<Variant[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(entryVariants)
    .where(
      and(
        eq(entryVariants.entryId, params.entryId),
        eq(entryVariants.ownerId, resolveTrustedOwnerId())
      )
    );
  const variantIds = rows.map((r) => r.variantId);
  const partsMap = await listPartsForVariants({ variantIds });
  return rows
    .map((r) => variantRowToDomain(r, partsMap.get(r.variantId) ?? []))
    .sort((a, b) => a.createdAt - b.createdAt);
}

type UpdateVariantDerivedParams = {
  variantId: string;
  derived: unknown | null;
  executor?: DbExecutor;
};

export function updateVariantDerived(params: UpdateVariantDerivedParams & { executor: DbExecutor }): void;
export function updateVariantDerived(params: UpdateVariantDerivedParams): Promise<void>;
export function updateVariantDerived(params: UpdateVariantDerivedParams): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    db
      .update(entryVariants)
      .set({ derivedJson: params.derived === null ? null : safeJsonStringify(params.derived) })
      .where(
        and(
          eq(entryVariants.variantId, params.variantId),
          eq(entryVariants.ownerId, resolveTrustedOwnerId())
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function getVariantById(params: { variantId: string }): Promise<Variant | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(entryVariants)
    .where(
      and(
        eq(entryVariants.variantId, params.variantId),
        eq(entryVariants.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  const row = rows[0];
  return row ? variantRowToDomain(row, []) : null;
}

type DeleteVariantParams = {
  entryId: string;
  variantId: string;
  executor?: DbExecutor;
};

export function deleteVariant(
  params: DeleteVariantParams & { executor: DbExecutor }
): { entryId: string; activeVariantId: string; deletedVariantId: string };
export function deleteVariant(
  params: DeleteVariantParams
): Promise<{ entryId: string; activeVariantId: string; deletedVariantId: string }>;
export function deleteVariant(
  params: DeleteVariantParams
):
  | Promise<{ entryId: string; activeVariantId: string; deletedVariantId: string }>
  | { entryId: string; activeVariantId: string; deletedVariantId: string } {
  const run = (
    db: DbExecutor
  ): { entryId: string; activeVariantId: string; deletedVariantId: string } => {
    const ownerId = resolveTrustedOwnerId();
    const entryRows = db
      .select({ activeVariantId: chatEntries.activeVariantId })
      .from(chatEntries)
      .where(
        and(
          eq(chatEntries.entryId, params.entryId),
          eq(chatEntries.ownerId, ownerId)
        )
      )
      .limit(1)
      .all();
    const entryRow = entryRows[0];
    if (!entryRow) throw new Error("Entry не найден");

    const variantRows = db
      .select({ variantId: entryVariants.variantId, createdAt: entryVariants.createdAt })
      .from(entryVariants)
      .where(
        and(
          eq(entryVariants.entryId, params.entryId),
          eq(entryVariants.ownerId, ownerId)
        )
      )
      .all();

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

    const idx = variantsSorted.findIndex((variant) => variant.variantId === params.variantId);
    if (idx < 0) throw new Error("Variant не найден");

    const fallback = variantsSorted[idx - 1] ?? variantsSorted[idx + 1];
    if (!fallback) throw new Error("Не найден fallback вариант");

    const shouldSwitchActive = entryRow.activeVariantId === params.variantId;
    const nextActiveVariantId = shouldSwitchActive ? fallback.variantId : entryRow.activeVariantId;

    if (shouldSwitchActive) {
      db
        .update(chatEntries)
        .set({ activeVariantId: nextActiveVariantId })
        .where(
          and(
            eq(chatEntries.entryId, params.entryId),
            eq(chatEntries.ownerId, ownerId)
          )
        )
        .run();
    }

    db
      .delete(entryVariants)
      .where(
        and(
          eq(entryVariants.entryId, params.entryId),
          eq(entryVariants.variantId, params.variantId),
          eq(entryVariants.ownerId, ownerId)
        )
      )
      .run();

    return {
      entryId: params.entryId,
      activeVariantId: nextActiveVariantId,
      deletedVariantId: params.variantId,
    };
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => db.transaction((tx) => run(tx)));
}

