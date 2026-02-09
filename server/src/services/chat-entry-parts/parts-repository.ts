import { and, eq, inArray } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { variantParts } from "../../db/schema";

import type {
  Part,
  PartChannel,
  PartLifespan,
  PartPayloadFormat,
  PartSource,
  PartVisibility,
} from "@shared/types/chat-entry-parts";

type StoredPayload = {
  format: PartPayloadFormat;
  value: string | object;
  schemaId?: string;
  label?: string;
};

function partRowToDomain(row: typeof variantParts.$inferSelect): Part {
  const payload = safeJsonParse<StoredPayload>(row.payloadJson, {
    format: "text",
    value: "",
  });
  const visibility = safeJsonParse<PartVisibility>(row.visibilityJson, {
    ui: "always",
    prompt: true,
  });
  const ui = safeJsonParse<Part["ui"]>(row.uiJson, undefined as any);
  const prompt = safeJsonParse<Part["prompt"]>(row.promptJson, undefined as any);
  const lifespan = safeJsonParse<PartLifespan>(row.lifespanJson, "infinite");
  const tags = safeJsonParse<string[] | undefined>(row.tagsJson, undefined);

  return {
    partId: row.partId,
    channel: row.channel as PartChannel,
    order: row.order,
    payload: payload.value,
    payloadFormat: payload.format,
    schemaId: payload.schemaId,
    label: payload.label,
    visibility,
    ui: ui ?? undefined,
    prompt: prompt ?? undefined,
    lifespan,
    createdTurn: row.createdTurn,
    source: row.source as PartSource,
    agentId: row.agentId ?? undefined,
    model: row.model ?? undefined,
    requestId: row.requestId ?? undefined,
    replacesPartId: row.replacesPartId ?? undefined,
    softDeleted: row.softDeleted ?? false,
    softDeletedAt: row.softDeletedAt ? row.softDeletedAt.getTime() : undefined,
    softDeletedBy: (row.softDeletedBy as any) ?? undefined,
    tags: tags ?? undefined,
  };
}

export async function listPartsForVariants(params: {
  variantIds: string[];
}): Promise<Map<string, Part[]>> {
  if (params.variantIds.length === 0) return new Map();
  const db = await initDb();
  const rows = await db
    .select()
    .from(variantParts)
    .where(inArray(variantParts.variantId, params.variantIds));

  const map = new Map<string, Part[]>();
  for (const r of rows) {
    const p = partRowToDomain(r);
    const list = map.get(r.variantId);
    if (list) list.push(p);
    else map.set(r.variantId, [p]);
  }
  return map;
}

export async function createPart(params: {
  ownerId?: string;
  variantId: string;
  channel: PartChannel;
  order: number;
  payload: string | object;
  payloadFormat: PartPayloadFormat;
  schemaId?: string;
  label?: string;
  visibility: PartVisibility;
  ui?: Part["ui"];
  prompt?: Part["prompt"];
  lifespan: PartLifespan;
  createdTurn: number;
  source: PartSource;
  agentId?: string;
  model?: string;
  requestId?: string;
  replacesPartId?: string;
  tags?: string[];
}): Promise<Part> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const partId = uuidv4();

  const payloadJson = safeJsonStringify({
    format: params.payloadFormat,
    value: params.payload,
    schemaId: params.schemaId,
    label: params.label,
  } satisfies StoredPayload);

  await db.insert(variantParts).values({
    partId,
    ownerId,
    variantId: params.variantId,
    channel: params.channel,
    order: params.order,
    payloadJson,
    visibilityJson: safeJsonStringify(params.visibility),
    uiJson: typeof params.ui === "undefined" ? null : safeJsonStringify(params.ui),
    promptJson: typeof params.prompt === "undefined" ? null : safeJsonStringify(params.prompt),
    lifespanJson: safeJsonStringify(params.lifespan),
    createdTurn: params.createdTurn,
    source: params.source,
    agentId: params.agentId ?? null,
    model: params.model ?? null,
    requestId: params.requestId ?? null,
    replacesPartId: params.replacesPartId ?? null,
    softDeleted: false,
    softDeletedAt: null,
    softDeletedBy: null,
    tagsJson: typeof params.tags === "undefined" ? null : safeJsonStringify(params.tags),
  });

  const rows = await db
    .select()
    .from(variantParts)
    .where(and(eq(variantParts.partId, partId), eq(variantParts.ownerId, ownerId)))
    .limit(1);
  const row = rows[0];
  if (!row) {
    // Should never happen; fallback to constructing a Part from inputs.
    return {
      partId,
      channel: params.channel,
      order: params.order,
      payload: params.payload,
      payloadFormat: params.payloadFormat,
      schemaId: params.schemaId,
      label: params.label,
      visibility: params.visibility,
      ui: params.ui,
      prompt: params.prompt,
      lifespan: params.lifespan,
      createdTurn: params.createdTurn,
      source: params.source,
      agentId: params.agentId,
      model: params.model,
      requestId: params.requestId,
      replacesPartId: params.replacesPartId,
      softDeleted: false,
      tags: params.tags,
    };
  }

  return partRowToDomain(row);
}

export async function updatePartPayloadText(params: {
  partId: string;
  payloadText: string;
  payloadFormat?: PartPayloadFormat;
}): Promise<void> {
  const db = await initDb();
  const rows = await db
    .select({ payloadJson: variantParts.payloadJson })
    .from(variantParts)
    .where(eq(variantParts.partId, params.partId))
    .limit(1);
  const existing = safeJsonParse<StoredPayload>(rows[0]?.payloadJson, {
    format: "text",
    value: "",
  });

  const payload: StoredPayload = {
    ...existing,
    format: params.payloadFormat ?? existing.format ?? "markdown",
    value: params.payloadText,
  };
  await db
    .update(variantParts)
    .set({ payloadJson: safeJsonStringify(payload) })
    .where(eq(variantParts.partId, params.partId));
}

export async function applyManualEditToPart(params: {
  partId: string;
  payloadText: string;
  payloadFormat?: PartPayloadFormat;
  requestId?: string;
}): Promise<void> {
  const db = await initDb();
  const rows = await db
    .select({ payloadJson: variantParts.payloadJson })
    .from(variantParts)
    .where(eq(variantParts.partId, params.partId))
    .limit(1);

  const existing = safeJsonParse<StoredPayload>(rows[0]?.payloadJson, {
    format: "text",
    value: "",
  });

  const payload: StoredPayload = {
    ...existing,
    format: params.payloadFormat ?? existing.format ?? "markdown",
    value: params.payloadText,
  };

  await db
    .update(variantParts)
    .set({
      payloadJson: safeJsonStringify(payload),
      source: "user",
      agentId: null,
      model: null,
      requestId: params.requestId ?? null,
    })
    .where(eq(variantParts.partId, params.partId));
}

export async function softDeletePart(params: {
  partId: string;
  by: "user" | "agent";
}): Promise<void> {
  const db = await initDb();
  await db
    .update(variantParts)
    .set({
      softDeleted: true,
      softDeletedAt: new Date(),
      softDeletedBy: params.by,
    })
    .where(eq(variantParts.partId, params.partId));
}

export async function updatePartReplacesPartId(params: {
  partId: string;
  replacesPartId: string | null;
}): Promise<void> {
  const db = await initDb();
  await db
    .update(variantParts)
    .set({ replacesPartId: params.replacesPartId })
    .where(eq(variantParts.partId, params.partId));
}

