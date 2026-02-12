import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import {
  chatEntries,
  chatMessages,
  worldInfoBindings,
  worldInfoBooks,
  worldInfoSettings,
  worldInfoTimedEffects,
} from "../../db/schema";
import { buildDefaultWorldInfoSettings } from "./world-info-defaults";
import {
  normalizeWorldInfoBookPayload,
  normalizeWorldInfoSettingsPatch,
  slugifyWorldInfoName,
} from "./world-info-normalizer";
import type {
  WorldInfoBindingDto,
  WorldInfoBindingRole,
  WorldInfoBookData,
  WorldInfoBookDto,
  WorldInfoBookSource,
  WorldInfoBookSummaryDto,
  WorldInfoScope,
  WorldInfoSettingsDto,
  WorldInfoTimedEffectDto,
} from "./world-info-types";

function rowToBookDto(row: typeof worldInfoBooks.$inferSelect): WorldInfoBookDto {
  const payload = normalizeWorldInfoBookPayload(safeJsonParse(row.dataJson, {}));
  return {
    id: row.id,
    ownerId: row.ownerId,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    data: payload.data,
    extensions: safeJsonParse(row.extensionsJson, null),
    source: row.source,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt ?? null,
  };
}

function rowToBookSummaryDto(row: typeof worldInfoBooks.$inferSelect): WorldInfoBookSummaryDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    slug: row.slug,
    name: row.name,
    description: row.description ?? null,
    source: row.source,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

function rowToSettingsDto(row: typeof worldInfoSettings.$inferSelect): WorldInfoSettingsDto {
  return {
    ownerId: row.ownerId,
    scanDepth: row.scanDepth,
    minActivations: row.minActivations,
    minDepthMax: row.minActivationsDepthMax,
    minActivationsDepthMax: row.minActivationsDepthMax,
    budgetPercent: row.budgetPercent,
    budgetCapTokens: row.budgetCapTokens,
    contextWindowTokens: row.contextWindowTokens,
    includeNames: row.includeNames,
    recursive: row.recursive,
    overflowAlert: row.overflowAlert,
    caseSensitive: row.caseSensitive,
    matchWholeWords: row.matchWholeWords,
    useGroupScoring: row.useGroupScoring,
    insertionStrategy: row.characterStrategy as 0 | 1 | 2,
    characterStrategy: row.characterStrategy as 0 | 1 | 2,
    maxRecursionSteps: row.maxRecursionSteps,
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToBindingDto(row: typeof worldInfoBindings.$inferSelect): WorldInfoBindingDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    scope: row.scope as WorldInfoScope,
    scopeId: row.scopeId ?? null,
    bookId: row.bookId,
    bindingRole: row.bindingRole as WorldInfoBindingRole,
    displayOrder: row.displayOrder,
    enabled: row.enabled,
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function rowToTimedEffectDto(
  row: typeof worldInfoTimedEffects.$inferSelect
): WorldInfoTimedEffectDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    chatId: row.chatId,
    branchId: row.branchId,
    entryHash: row.entryHash,
    bookId: row.bookId ?? null,
    entryUid: row.entryUid ?? null,
    effectType: row.effectType,
    startMessageIndex: row.startMessageIndex,
    endMessageIndex: row.endMessageIndex,
    protected: row.protected,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function findActiveBookBySlug(params: {
  ownerId: string;
  slug: string;
  excludeBookId?: string;
}): Promise<WorldInfoBookDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(worldInfoBooks)
    .where(
      and(
        eq(worldInfoBooks.ownerId, params.ownerId),
        eq(worldInfoBooks.slug, params.slug),
        isNull(worldInfoBooks.deletedAt)
      )
    )
    .limit(20);
  const found = rows.find((row) => row.id !== params.excludeBookId);
  return found ? rowToBookDto(found) : null;
}

export async function resolveUniqueBookSlug(params: {
  ownerId: string;
  preferredSlug: string;
  excludeBookId?: string;
}): Promise<string> {
  const base = slugifyWorldInfoName(params.preferredSlug);
  let nextSlug = base;
  let idx = 2;
  while (true) {
    const exists = await findActiveBookBySlug({
      ownerId: params.ownerId,
      slug: nextSlug,
      excludeBookId: params.excludeBookId,
    });
    if (!exists) return nextSlug;
    nextSlug = `${base}-${idx}`;
    idx += 1;
  }
}

export async function listWorldInfoBooks(params: {
  ownerId?: string;
  query?: string;
  limit?: number;
  before?: number;
}): Promise<{ items: WorldInfoBookSummaryDto[]; nextCursor: number | null }> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const limit = Math.max(1, Math.min(200, params.limit ?? 50));
  const where = [eq(worldInfoBooks.ownerId, ownerId), isNull(worldInfoBooks.deletedAt)];
  if (typeof params.before === "number") {
    where.push(lt(worldInfoBooks.updatedAt, new Date(params.before)));
  }

  const baseRows = await db
    .select()
    .from(worldInfoBooks)
    .where(and(...where))
    .orderBy(desc(worldInfoBooks.updatedAt), desc(worldInfoBooks.id))
    .limit(limit + 1);

  const filtered = params.query
    ? baseRows.filter((row) => {
        const q = params.query!.toLowerCase();
        return (
          row.name.toLowerCase().includes(q) ||
          row.slug.toLowerCase().includes(q) ||
          (row.description ?? "").toLowerCase().includes(q)
        );
      })
    : baseRows;

  const page = filtered.slice(0, limit);
  const next = filtered.length > limit ? page[page.length - 1]?.updatedAt ?? null : null;
  return {
    items: page.map(rowToBookSummaryDto),
    nextCursor: next ? next.getTime() : null,
  };
}

export async function getWorldInfoBookById(id: string): Promise<WorldInfoBookDto | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(worldInfoBooks)
    .where(and(eq(worldInfoBooks.id, id), isNull(worldInfoBooks.deletedAt)))
    .limit(1);
  return rows[0] ? rowToBookDto(rows[0]) : null;
}

export async function getWorldInfoBooksByIds(params: {
  ownerId?: string;
  ids: string[];
}): Promise<WorldInfoBookDto[]> {
  if (params.ids.length === 0) return [];
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const rows = await db
    .select()
    .from(worldInfoBooks)
    .where(
      and(
        eq(worldInfoBooks.ownerId, ownerId),
        inArray(worldInfoBooks.id, params.ids),
        isNull(worldInfoBooks.deletedAt)
      )
    );
  const byId = new Map(rows.map((row) => [row.id, rowToBookDto(row)]));
  return params.ids.map((id) => byId.get(id)).filter((item): item is WorldInfoBookDto => Boolean(item));
}

export async function createWorldInfoBook(params: {
  ownerId?: string;
  name: string;
  slug?: string;
  description?: string | null;
  data?: unknown;
  extensions?: unknown;
  source?: WorldInfoBookSource;
}): Promise<WorldInfoBookDto> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const ts = new Date();
  const id = uuidv4();
  const normalized = normalizeWorldInfoBookPayload(params.data ?? {});
  const slug = await resolveUniqueBookSlug({
    ownerId,
    preferredSlug: params.slug?.trim() || slugifyWorldInfoName(params.name),
  });

  await db.insert(worldInfoBooks).values({
    id,
    ownerId,
    slug,
    name: params.name,
    description: params.description ?? null,
    dataJson: safeJsonStringify(normalized.data, '{"entries":{}}'),
    extensionsJson:
      typeof params.extensions === "undefined"
        ? null
        : safeJsonStringify(params.extensions, "{}"),
    source: params.source ?? "native",
    version: 1,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
  });

  const created = await getWorldInfoBookById(id);
  if (!created) {
    throw new Error("Failed to create world info book.");
  }
  return created;
}

export async function updateWorldInfoBook(params: {
  id: string;
  ownerId?: string;
  name?: string;
  slug?: string;
  description?: string | null;
  data?: unknown;
  extensions?: unknown;
  version?: number;
}): Promise<{ item: WorldInfoBookDto | null; conflict: boolean }> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const current = await getWorldInfoBookById(params.id);
  if (!current || current.ownerId !== ownerId) return { item: null, conflict: false };

  if (typeof params.version === "number" && params.version !== current.version) {
    return { item: current, conflict: true };
  }

  const ts = new Date();
  const patch: Partial<typeof worldInfoBooks.$inferInsert> = {
    updatedAt: ts,
    version: current.version + 1,
  };

  if (typeof params.name === "string") patch.name = params.name;
  if (typeof params.description !== "undefined") patch.description = params.description;
  if (typeof params.slug === "string") {
    patch.slug = await resolveUniqueBookSlug({
      ownerId,
      preferredSlug: params.slug,
      excludeBookId: params.id,
    });
  }
  if (typeof params.data !== "undefined") {
    const normalized = normalizeWorldInfoBookPayload(params.data);
    patch.dataJson = safeJsonStringify(normalized.data, '{"entries":{}}');
  }
  if (typeof params.extensions !== "undefined") {
    patch.extensionsJson =
      params.extensions === null ? null : safeJsonStringify(params.extensions, "{}");
  }

  await db
    .update(worldInfoBooks)
    .set(patch)
    .where(and(eq(worldInfoBooks.id, params.id), eq(worldInfoBooks.ownerId, ownerId)));

  return { item: await getWorldInfoBookById(params.id), conflict: false };
}

export async function softDeleteWorldInfoBook(params: {
  id: string;
  ownerId?: string;
}): Promise<boolean> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const current = await getWorldInfoBookById(params.id);
  if (!current || current.ownerId !== ownerId) return false;
  const ts = new Date();
  await db
    .update(worldInfoBooks)
    .set({ deletedAt: ts, updatedAt: ts })
    .where(and(eq(worldInfoBooks.id, params.id), eq(worldInfoBooks.ownerId, ownerId)));
  return true;
}

export async function duplicateWorldInfoBook(params: {
  id: string;
  ownerId?: string;
  name?: string;
  slug?: string;
}): Promise<WorldInfoBookDto | null> {
  const src = await getWorldInfoBookById(params.id);
  if (!src) return null;
  return createWorldInfoBook({
    ownerId: params.ownerId ?? src.ownerId,
    name: params.name ?? `${src.name} (copy)`,
    slug: params.slug ?? `${src.slug}-copy`,
    description: src.description,
    data: src.data,
    extensions: src.extensions,
    source: src.source,
  });
}

export async function getWorldInfoSettings(params?: {
  ownerId?: string;
}): Promise<WorldInfoSettingsDto> {
  const db = await initDb();
  const ownerId = params?.ownerId ?? "global";
  const rows = await db
    .select()
    .from(worldInfoSettings)
    .where(eq(worldInfoSettings.ownerId, ownerId))
    .limit(1);
  if (rows[0]) return rowToSettingsDto(rows[0]);

  const ts = new Date();
  const defaults = buildDefaultWorldInfoSettings(ownerId);
  await db.insert(worldInfoSettings).values({
    ownerId,
    scanDepth: defaults.scanDepth,
    minActivations: defaults.minActivations,
    minActivationsDepthMax: defaults.minActivationsDepthMax,
    budgetPercent: defaults.budgetPercent,
    budgetCapTokens: defaults.budgetCapTokens,
    contextWindowTokens: defaults.contextWindowTokens,
    includeNames: defaults.includeNames,
    recursive: defaults.recursive,
    overflowAlert: defaults.overflowAlert,
    caseSensitive: defaults.caseSensitive,
    matchWholeWords: defaults.matchWholeWords,
    useGroupScoring: defaults.useGroupScoring,
    characterStrategy: defaults.insertionStrategy,
    maxRecursionSteps: defaults.maxRecursionSteps,
    metaJson: null,
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await db
    .select()
    .from(worldInfoSettings)
    .where(eq(worldInfoSettings.ownerId, ownerId))
    .limit(1);
  return rowToSettingsDto(created[0]);
}

export async function patchWorldInfoSettings(params: {
  ownerId?: string;
  patch: Partial<Omit<WorldInfoSettingsDto, "ownerId" | "createdAt" | "updatedAt">>;
}): Promise<WorldInfoSettingsDto> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const current = await getWorldInfoSettings({ ownerId });
  const ts = new Date();

  const normalized = normalizeWorldInfoSettingsPatch({
    patch: params.patch,
    current,
  });

  await db
    .update(worldInfoSettings)
    .set({
      scanDepth: normalized.scanDepth,
      minActivations: normalized.minActivations,
      minActivationsDepthMax: normalized.minDepthMax,
      budgetPercent: normalized.budgetPercent,
      budgetCapTokens: normalized.budgetCapTokens,
      contextWindowTokens: normalized.contextWindowTokens,
      includeNames: normalized.includeNames,
      recursive: normalized.recursive,
      overflowAlert: normalized.overflowAlert,
      caseSensitive: normalized.caseSensitive,
      matchWholeWords: normalized.matchWholeWords,
      useGroupScoring: normalized.useGroupScoring,
      characterStrategy: normalized.insertionStrategy,
      maxRecursionSteps: normalized.maxRecursionSteps,
      metaJson:
        normalized.meta === null ? null : safeJsonStringify(normalized.meta, "null"),
      updatedAt: ts,
    })
    .where(eq(worldInfoSettings.ownerId, ownerId));

  return getWorldInfoSettings({ ownerId });
}

export async function listWorldInfoBindings(params: {
  ownerId?: string;
  scope?: WorldInfoScope;
  scopeId?: string | null;
}): Promise<WorldInfoBindingDto[]> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const where = [eq(worldInfoBindings.ownerId, ownerId)];
  if (params.scope) where.push(eq(worldInfoBindings.scope, params.scope));
  if (typeof params.scopeId === "string") where.push(eq(worldInfoBindings.scopeId, params.scopeId));
  if (params.scopeId === null) where.push(isNull(worldInfoBindings.scopeId));

  const rows = await db
    .select()
    .from(worldInfoBindings)
    .where(and(...where))
    .orderBy(worldInfoBindings.displayOrder, worldInfoBindings.createdAt);
  return rows.map(rowToBindingDto);
}

export async function replaceWorldInfoBindings(params: {
  ownerId?: string;
  scope: WorldInfoScope;
  scopeId?: string | null;
  items: Array<{
    bookId: string;
    bindingRole?: WorldInfoBindingRole;
    displayOrder?: number;
    enabled?: boolean;
    meta?: unknown;
  }>;
}): Promise<WorldInfoBindingDto[]> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const scopeId = params.scope === "global" ? null : (params.scopeId ?? null);
  const ts = new Date();

  const existing = await listWorldInfoBindings({
    ownerId,
    scope: params.scope,
    scopeId,
  });
  const existingByBookId = new Map(existing.map((item) => [item.bookId, item]));

  const incomingBookIds = new Set<string>();
  for (const [idx, item] of params.items.entries()) {
    incomingBookIds.add(item.bookId);
    const found = existingByBookId.get(item.bookId);
    if (found) {
      await db
        .update(worldInfoBindings)
        .set({
          bindingRole: item.bindingRole ?? found.bindingRole,
          displayOrder: item.displayOrder ?? idx,
          enabled: item.enabled ?? true,
          metaJson:
            typeof item.meta === "undefined"
              ? safeJsonStringify(found.meta, "null")
              : item.meta === null
                ? null
                : safeJsonStringify(item.meta, "{}"),
          updatedAt: ts,
        })
        .where(eq(worldInfoBindings.id, found.id));
      continue;
    }

    await db.insert(worldInfoBindings).values({
      id: uuidv4(),
      ownerId,
      scope: params.scope,
      scopeId,
      bookId: item.bookId,
      bindingRole: item.bindingRole ?? "additional",
      displayOrder: item.displayOrder ?? idx,
      enabled: item.enabled ?? true,
      metaJson:
        typeof item.meta === "undefined"
          ? null
          : item.meta === null
            ? null
            : safeJsonStringify(item.meta, "{}"),
      createdAt: ts,
      updatedAt: ts,
    });
  }

  const toDelete = existing.filter((item) => !incomingBookIds.has(item.bookId));
  if (toDelete.length > 0) {
    await db
      .delete(worldInfoBindings)
      .where(inArray(worldInfoBindings.id, toDelete.map((item) => item.id)));
  }

  return listWorldInfoBindings({ ownerId, scope: params.scope, scopeId });
}

export async function listWorldInfoTimedEffects(params: {
  ownerId?: string;
  chatId: string;
  branchId: string;
}): Promise<WorldInfoTimedEffectDto[]> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const rows = await db
    .select()
    .from(worldInfoTimedEffects)
    .where(
      and(
        eq(worldInfoTimedEffects.ownerId, ownerId),
        eq(worldInfoTimedEffects.chatId, params.chatId),
        eq(worldInfoTimedEffects.branchId, params.branchId)
      )
    );
  return rows.map(rowToTimedEffectDto);
}

export async function deleteWorldInfoTimedEffectsByIds(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await initDb();
  await db.delete(worldInfoTimedEffects).where(inArray(worldInfoTimedEffects.id, ids));
}

export async function upsertWorldInfoTimedEffect(params: {
  ownerId?: string;
  chatId: string;
  branchId: string;
  entryHash: string;
  bookId?: string | null;
  entryUid?: number | null;
  effectType: "sticky" | "cooldown";
  startMessageIndex: number;
  endMessageIndex: number;
  protected?: boolean;
}): Promise<WorldInfoTimedEffectDto> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const ts = new Date();
  const rows = await db
    .select()
    .from(worldInfoTimedEffects)
    .where(
      and(
        eq(worldInfoTimedEffects.ownerId, ownerId),
        eq(worldInfoTimedEffects.chatId, params.chatId),
        eq(worldInfoTimedEffects.branchId, params.branchId),
        eq(worldInfoTimedEffects.entryHash, params.entryHash),
        eq(worldInfoTimedEffects.effectType, params.effectType)
      )
    )
    .limit(1);

  const existing = rows[0];
  if (existing) {
    await db
      .update(worldInfoTimedEffects)
      .set({
        bookId: params.bookId ?? null,
        entryUid: params.entryUid ?? null,
        startMessageIndex: params.startMessageIndex,
        endMessageIndex: params.endMessageIndex,
        protected: params.protected ?? false,
        updatedAt: ts,
      })
      .where(eq(worldInfoTimedEffects.id, existing.id));
    const updated = await db
      .select()
      .from(worldInfoTimedEffects)
      .where(eq(worldInfoTimedEffects.id, existing.id))
      .limit(1);
    return rowToTimedEffectDto(updated[0]);
  }

  const id = uuidv4();
  await db.insert(worldInfoTimedEffects).values({
    id,
    ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    entryHash: params.entryHash,
    bookId: params.bookId ?? null,
    entryUid: params.entryUid ?? null,
    effectType: params.effectType,
    startMessageIndex: params.startMessageIndex,
    endMessageIndex: params.endMessageIndex,
    protected: params.protected ?? false,
    createdAt: ts,
    updatedAt: ts,
  });
  const created = await db
    .select()
    .from(worldInfoTimedEffects)
    .where(eq(worldInfoTimedEffects.id, id))
    .limit(1);
  return rowToTimedEffectDto(created[0]);
}

export async function getBranchMessageIndex(params: {
  chatId: string;
  branchId: string;
}): Promise<number> {
  const db = await initDb();
  const entryRows = await db
    .select({ id: chatEntries.entryId })
    .from(chatEntries)
    .where(
      and(
        eq(chatEntries.chatId, params.chatId),
        eq(chatEntries.branchId, params.branchId),
        eq(chatEntries.softDeleted, false)
      )
    );
  const legacyRows = await db
    .select({ metaJson: chatMessages.metaJson })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.chatId, params.chatId),
        eq(chatMessages.branchId, params.branchId)
      )
    );
  const legacyCount = legacyRows.filter((row) => {
    const meta = safeJsonParse(row.metaJson, null) as null | Record<string, unknown>;
    return !(meta?.deleted === true || typeof meta?.deletedAt === "string");
  }).length;
  return Math.max(entryRows.length, legacyCount);
}

export function getBookDataEntries(book: WorldInfoBookDto): Record<string, unknown> {
  return normalizeWorldInfoBookPayload(book.data).data.entries;
}

export function cloneWorldInfoBookData(data: WorldInfoBookData): WorldInfoBookData {
  return safeJsonParse(safeJsonStringify(data, '{"entries":{}}'), {
    entries: {},
    extensions: {},
  });
}
