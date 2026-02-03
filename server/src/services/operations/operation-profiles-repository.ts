import { and, asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { operationProfiles } from "../../db/schema";

import type {
  OperationProfile,
  OperationProfileUpsertInput,
} from "@shared/types/operation-profiles";
import { validateOperationProfileUpsertInput } from "./operation-profile-validator";

type OperationProfileSpecRow = {
  operations: OperationProfile["operations"];
};

function parseSpecJson(value: string): OperationProfileSpecRow {
  const parsed = safeJsonParse<unknown>(value, { operations: [] });
  if (!parsed || typeof parsed !== "object") return { operations: [] };
  const ops = (parsed as { operations?: unknown }).operations;
  return { operations: Array.isArray(ops) ? (ops as OperationProfile["operations"]) : [] };
}

function rowToDto(row: typeof operationProfiles.$inferSelect): OperationProfile {
  const spec = parseSpecJson(row.specJson);
  return {
    profileId: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description ?? undefined,
    enabled: row.enabled,
    executionMode: row.executionMode,
    operationProfileSessionId: row.operationProfileSessionId,
    version: row.version,
    operations: spec.operations,
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listOperationProfiles(params?: {
  ownerId?: string;
}): Promise<OperationProfile[]> {
  const db = await initDb();
  const ownerId = params?.ownerId ?? "global";
  const rows = await db
    .select()
    .from(operationProfiles)
    .where(eq(operationProfiles.ownerId, ownerId))
    .orderBy(asc(operationProfiles.name));
  return rows.map(rowToDto);
}

export async function getOperationProfileById(
  id: string
): Promise<OperationProfile | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(operationProfiles)
    .where(eq(operationProfiles.id, id))
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createOperationProfile(params: {
  ownerId?: string;
  input: OperationProfileUpsertInput;
}): Promise<OperationProfile> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const ts = new Date();
  const profileId = uuidv4();

  const validated = validateOperationProfileUpsertInput(params.input);

  await db.insert(operationProfiles).values({
    id: profileId,
    ownerId,
    name: validated.name,
    description: validated.description ?? null,
    enabled: validated.enabled,
    executionMode: validated.executionMode,
    operationProfileSessionId: validated.operationProfileSessionId,
    version: 1,
    specJson: safeJsonStringify({ operations: validated.operations }, "{}"),
    metaJson: validated.meta === null ? null : safeJsonStringify(validated.meta),
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getOperationProfileById(profileId);
  if (created) return created;
  return {
    profileId,
    ownerId,
    name: validated.name,
    description: validated.description,
    enabled: validated.enabled,
    executionMode: validated.executionMode,
    operationProfileSessionId: validated.operationProfileSessionId,
    version: 1,
    operations: validated.operations,
    meta: validated.meta,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function updateOperationProfile(params: {
  ownerId?: string;
  profileId: string;
  patch: Partial<OperationProfileUpsertInput>;
}): Promise<OperationProfile | null> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const current = await getOperationProfileById(params.profileId);
  if (!current) return null;

  const nextInput: OperationProfileUpsertInput = {
    name: typeof params.patch.name === "string" ? params.patch.name : current.name,
    description:
      typeof params.patch.description === "string"
        ? params.patch.description
        : typeof params.patch.description === "undefined"
          ? current.description
          : undefined,
    enabled: typeof params.patch.enabled === "boolean" ? params.patch.enabled : current.enabled,
    executionMode:
      typeof params.patch.executionMode === "string"
        ? params.patch.executionMode
        : current.executionMode,
    operationProfileSessionId:
      typeof params.patch.operationProfileSessionId === "string"
        ? params.patch.operationProfileSessionId
        : current.operationProfileSessionId,
    operations: Array.isArray(params.patch.operations)
      ? params.patch.operations
      : current.operations,
    meta: typeof params.patch.meta === "undefined" ? current.meta : params.patch.meta,
  };

  const validated = validateOperationProfileUpsertInput(nextInput);

  const ts = new Date();
  const nextVersion = current.version + 1;

  await db
    .update(operationProfiles)
    .set({
      name: validated.name,
      description: validated.description ?? null,
      enabled: validated.enabled,
      executionMode: validated.executionMode,
      operationProfileSessionId: validated.operationProfileSessionId,
      version: nextVersion,
      specJson: safeJsonStringify({ operations: validated.operations }, "{}"),
      metaJson: validated.meta === null ? null : safeJsonStringify(validated.meta),
      updatedAt: ts,
    })
    .where(and(eq(operationProfiles.id, params.profileId), eq(operationProfiles.ownerId, ownerId)));

  return getOperationProfileById(params.profileId);
}

export async function deleteOperationProfile(params: {
  ownerId?: string;
  profileId: string;
}): Promise<void> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  await db
    .delete(operationProfiles)
    .where(and(eq(operationProfiles.id, params.profileId), eq(operationProfiles.ownerId, ownerId)));
}

