import { asc, desc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { userPersons, userPersonsSettings } from "../../db/schema";

export type UserPersonDto = {
  id: string;
  ownerId: string;
  name: string;
  prefix?: string;
  avatarUrl?: string;
  type: "default" | "extended";
  contentTypeDefault?: string;
  contentTypeExtended?: unknown[];
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof userPersons.$inferSelect): UserPersonDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    prefix: row.prefix ?? undefined,
    avatarUrl: row.avatarUrl ?? undefined,
    type: row.type,
    contentTypeDefault: row.contentTypeDefault ?? undefined,
    contentTypeExtended: safeJsonParse(row.contentTypeExtendedJson, undefined),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type UserPersonsSettingsDto = {
  ownerId: string;
  selectedId: string | null;
  enabled: boolean;
  pageSize?: number;
  sortType?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function settingsRowToDto(
  row: typeof userPersonsSettings.$inferSelect
): UserPersonsSettingsDto {
  const meta = safeJsonParse(row.metaJson, null) as
    | null
    | Record<string, unknown>;
  return {
    ownerId: row.ownerId,
    selectedId: row.selectedId ?? null,
    enabled: row.enabled,
    pageSize: typeof meta?.pageSize === "number" ? meta.pageSize : undefined,
    sortType:
      typeof meta?.sortType === "string" || meta?.sortType === null
        ? (meta.sortType as string | null)
        : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listUserPersons(params?: {
  ownerId?: string;
}): Promise<UserPersonDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(userPersons)
    .where(eq(userPersons.ownerId, params?.ownerId ?? "global"))
    .orderBy(asc(userPersons.name), desc(userPersons.updatedAt));
  return rows.map(rowToDto);
}

export async function getUserPersonById(
  id: string
): Promise<UserPersonDto | null> {
  const db = await initDb();
  const rows = await db.select().from(userPersons).where(eq(userPersons.id, id));
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createUserPerson(params: {
  id?: string;
  ownerId?: string;
  name: string;
  prefix?: string;
  avatarUrl?: string;
  type?: "default" | "extended";
  contentTypeDefault?: string;
  contentTypeExtended?: unknown[];
  createdAt?: Date;
  updatedAt?: Date;
}): Promise<UserPersonDto> {
  const db = await initDb();
  const now = new Date();
  const id =
    typeof params.id === "string" && params.id.length > 0 ? params.id : uuidv4();
  const createdAt = params.createdAt ?? now;
  const updatedAt = params.updatedAt ?? now;

  await db.insert(userPersons).values({
    id,
    ownerId: params.ownerId ?? "global",
    name: params.name,
    prefix: typeof params.prefix === "string" ? params.prefix : null,
    avatarUrl: typeof params.avatarUrl === "string" ? params.avatarUrl : null,
    type: params.type ?? "default",
    contentTypeDefault:
      typeof params.contentTypeDefault === "string"
        ? params.contentTypeDefault
        : null,
    contentTypeExtendedJson:
      typeof params.contentTypeExtended === "undefined"
        ? null
        : safeJsonStringify(params.contentTypeExtended, "[]"),
    createdAt,
    updatedAt,
  });

  const created = await getUserPersonById(id);
  if (!created) {
    return {
      id,
      ownerId: params.ownerId ?? "global",
      name: params.name,
      prefix: params.prefix,
      avatarUrl: params.avatarUrl,
      type: params.type ?? "default",
      contentTypeDefault: params.contentTypeDefault,
      contentTypeExtended: params.contentTypeExtended,
      createdAt,
      updatedAt,
    };
  }
  return created;
}

export async function updateUserPerson(params: {
  id: string;
  name?: string;
  prefix?: string;
  avatarUrl?: string;
  type?: "default" | "extended";
  contentTypeDefault?: string;
  contentTypeExtended?: unknown[];
  updatedAt?: Date;
}): Promise<UserPersonDto | null> {
  const db = await initDb();
  const current = await getUserPersonById(params.id);
  if (!current) return null;

  const set: Partial<typeof userPersons.$inferInsert> = {
    updatedAt: params.updatedAt ?? new Date(),
  };

  if (typeof params.name === "string") set.name = params.name;
  if (typeof params.prefix !== "undefined")
    set.prefix = typeof params.prefix === "string" ? params.prefix : null;
  if (typeof params.avatarUrl !== "undefined")
    set.avatarUrl = typeof params.avatarUrl === "string" ? params.avatarUrl : null;
  if (typeof params.type === "string") set.type = params.type;
  if (typeof params.contentTypeDefault !== "undefined")
    set.contentTypeDefault =
      typeof params.contentTypeDefault === "string"
        ? params.contentTypeDefault
        : null;
  if (typeof params.contentTypeExtended !== "undefined")
    set.contentTypeExtendedJson = safeJsonStringify(params.contentTypeExtended, "[]");

  await db.update(userPersons).set(set).where(eq(userPersons.id, params.id));
  return getUserPersonById(params.id);
}

export async function deleteUserPerson(id: string): Promise<void> {
  const db = await initDb();
  await db.delete(userPersons).where(eq(userPersons.id, id));
}

export async function getUserPersonsSettings(params?: {
  ownerId?: string;
}): Promise<UserPersonsSettingsDto> {
  const db = await initDb();
  const ownerId = params?.ownerId ?? "global";
  const rows = await db
    .select()
    .from(userPersonsSettings)
    .where(eq(userPersonsSettings.ownerId, ownerId))
    .limit(1);

  if (rows[0]) return settingsRowToDto(rows[0]);

  const ts = new Date();
  // Ensure settings row exists (idempotent).
  await db.insert(userPersonsSettings).values({
    ownerId,
    selectedId: null,
    enabled: false,
    metaJson: null,
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await db
    .select()
    .from(userPersonsSettings)
    .where(eq(userPersonsSettings.ownerId, ownerId))
    .limit(1);
  if (!created[0]) {
    // Should not happen, but keep runtime safe.
    return {
      ownerId,
      selectedId: null,
      enabled: false,
      createdAt: ts,
      updatedAt: ts,
    };
  }
  return settingsRowToDto(created[0]);
}

export async function updateUserPersonsSettings(params: {
  ownerId?: string;
  selectedId?: string | null;
  enabled?: boolean;
  pageSize?: number;
  sortType?: string | null;
}): Promise<UserPersonsSettingsDto> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const current = await getUserPersonsSettings({ ownerId });

  const nextSelectedId =
    typeof params.selectedId === "undefined" ? current.selectedId : params.selectedId;
  const nextEnabled =
    typeof params.enabled === "undefined" ? current.enabled : params.enabled;
  const nextPageSize =
    typeof params.pageSize === "undefined" ? current.pageSize : params.pageSize;
  const nextSortType =
    typeof params.sortType === "undefined" ? current.sortType ?? null : params.sortType;

  await db
    .update(userPersonsSettings)
    .set({
      selectedId: nextSelectedId,
      enabled: nextEnabled,
      metaJson: safeJsonStringify({
        pageSize: nextPageSize,
        sortType: nextSortType,
      }),
      updatedAt: new Date(),
    })
    .where(eq(userPersonsSettings.ownerId, ownerId));

  return getUserPersonsSettings({ ownerId });
}

export async function getSelectedUserPerson(params?: {
  ownerId?: string;
}): Promise<UserPersonDto | null> {
  const settings = await getUserPersonsSettings({ ownerId: params?.ownerId });
  if (!settings.enabled) return null;
  if (!settings.selectedId) return null;
  return getUserPersonById(settings.selectedId);
}

