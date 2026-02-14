import { and, asc, eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { operationBlocks } from "../../db/schema";
import { validateOperationBlockUpsertInput } from "./operation-block-validator";

import type {
  OperationBlock,
  OperationBlockUpsertInput,
} from "@shared/types/operation-profiles";

type OperationBlockSpecRow = {
  operations: OperationBlock["operations"];
};

function parseSpecJson(value: string): OperationBlockSpecRow {
  const parsed = safeJsonParse<unknown>(value, { operations: [] });
  if (!parsed || typeof parsed !== "object") return { operations: [] };
  const ops = (parsed as { operations?: unknown }).operations;
  return { operations: Array.isArray(ops) ? (ops as OperationBlock["operations"]) : [] };
}

function rowToDto(row: typeof operationBlocks.$inferSelect): OperationBlock {
  const spec = parseSpecJson(row.specJson);
  return {
    blockId: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description ?? undefined,
    enabled: row.enabled,
    version: row.version,
    operations: spec.operations,
    meta: safeJsonParse(row.metaJson, null),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function resolveImportedOperationBlockName(input: string, existingNames: string[]): string {
  const base = input.trim() || "Imported block";
  if (!existingNames.includes(base)) return base;
  for (let idx = 2; idx <= 9999; idx += 1) {
    const candidate = `${base} (imported ${idx})`;
    if (!existingNames.includes(candidate)) return candidate;
  }
  return `${base} (imported ${Date.now()})`;
}

export async function listOperationBlocks(params?: {
  ownerId?: string;
}): Promise<OperationBlock[]> {
  const db = await initDb();
  const ownerId = params?.ownerId ?? "global";
  const rows = await db
    .select()
    .from(operationBlocks)
    .where(eq(operationBlocks.ownerId, ownerId))
    .orderBy(asc(operationBlocks.name));
  return rows.map(rowToDto);
}

export async function getOperationBlockById(
  id: string
): Promise<OperationBlock | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(operationBlocks)
    .where(eq(operationBlocks.id, id))
    .limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function createOperationBlock(params: {
  ownerId?: string;
  input: OperationBlockUpsertInput;
}): Promise<OperationBlock> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const ts = new Date();
  const blockId = uuidv4();

  const validated = validateOperationBlockUpsertInput(params.input);

  await db.insert(operationBlocks).values({
    id: blockId,
    ownerId,
    name: validated.name,
    description: validated.description ?? null,
    enabled: validated.enabled,
    version: 1,
    specJson: safeJsonStringify({ operations: validated.operations }, "{}"),
    metaJson: validated.meta === null ? null : safeJsonStringify(validated.meta),
    createdAt: ts,
    updatedAt: ts,
  });

  const created = await getOperationBlockById(blockId);
  if (created) return created;
  return {
    blockId,
    ownerId,
    name: validated.name,
    description: validated.description,
    enabled: validated.enabled,
    version: 1,
    operations: validated.operations,
    meta: validated.meta,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function updateOperationBlock(params: {
  ownerId?: string;
  blockId: string;
  patch: Partial<OperationBlockUpsertInput>;
}): Promise<OperationBlock | null> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const current = await getOperationBlockById(params.blockId);
  if (!current) return null;

  const nextInput: OperationBlockUpsertInput = {
    name: typeof params.patch.name === "string" ? params.patch.name : current.name,
    description:
      typeof params.patch.description === "string"
        ? params.patch.description
        : typeof params.patch.description === "undefined"
          ? current.description
          : undefined,
    enabled: typeof params.patch.enabled === "boolean" ? params.patch.enabled : current.enabled,
    operations: Array.isArray(params.patch.operations)
      ? params.patch.operations
      : current.operations,
    meta: typeof params.patch.meta === "undefined" ? current.meta : params.patch.meta,
  };

  const validated = validateOperationBlockUpsertInput(nextInput);

  const ts = new Date();
  const nextVersion = current.version + 1;

  await db
    .update(operationBlocks)
    .set({
      name: validated.name,
      description: validated.description ?? null,
      enabled: validated.enabled,
      version: nextVersion,
      specJson: safeJsonStringify({ operations: validated.operations }, "{}"),
      metaJson: validated.meta === null ? null : safeJsonStringify(validated.meta),
      updatedAt: ts,
    })
    .where(and(eq(operationBlocks.id, params.blockId), eq(operationBlocks.ownerId, ownerId)));

  return getOperationBlockById(params.blockId);
}

export async function deleteOperationBlock(params: {
  ownerId?: string;
  blockId: string;
}): Promise<void> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  await db
    .delete(operationBlocks)
    .where(and(eq(operationBlocks.id, params.blockId), eq(operationBlocks.ownerId, ownerId)));
}
