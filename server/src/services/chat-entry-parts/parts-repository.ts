import { randomUUID as uuidv4 } from "node:crypto";

import { and, eq, inArray } from "drizzle-orm";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { HttpError } from "../../core/middleware/error-handler";
import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { type DbExecutor, initDb } from "../../db/client";
import { entryVariants, variantParts } from "../../db/schema";

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
  value: string | object | number | boolean | null;
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
    .where(
      and(
        inArray(variantParts.variantId, params.variantIds),
        eq(variantParts.ownerId, resolveTrustedOwnerId())
      )
    );

  const map = new Map<string, Part[]>();
  for (const r of rows) {
    const p = partRowToDomain(r);
    const list = map.get(r.variantId);
    if (list) list.push(p);
    else map.set(r.variantId, [p]);
  }
  return map;
}

export type CreatePartParams = {
  ownerId?: string;
  variantId: string;
  channel: PartChannel;
  order: number;
  payload: string | object | number | boolean | null;
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
  replacesPartId?: string | null;
  tags?: string[];
  executor?: DbExecutor;
};

export function createPart(params: CreatePartParams & { executor: DbExecutor }): Part;
export function createPart(params: CreatePartParams): Promise<Part>;
export function createPart(params: CreatePartParams): Promise<Part> | Part {
  const run = (db: DbExecutor): Part => {
    const ownerId = resolveTrustedOwnerId(params.ownerId);
    const parent = db
      .select({ variantId: entryVariants.variantId })
      .from(entryVariants)
      .where(
        and(
          eq(entryVariants.variantId, params.variantId),
          eq(entryVariants.ownerId, ownerId)
        )
      )
      .limit(1)
      .get();
    if (!parent) {
      throw new HttpError(404, "Entry variant not found", "NOT_FOUND");
    }
    const partId = uuidv4();

    const payloadJson = safeJsonStringify({
      format: params.payloadFormat,
      value: params.payload,
      schemaId: params.schemaId,
      label: params.label,
    } satisfies StoredPayload);

    db.insert(variantParts).values({
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
    }).run();

    const rows = db
      .select()
      .from(variantParts)
      .where(and(eq(variantParts.partId, partId), eq(variantParts.ownerId, ownerId)))
      .limit(1)
      .all();
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
        replacesPartId: params.replacesPartId ?? undefined,
        softDeleted: false,
        tags: params.tags,
      };
    }

    return partRowToDomain(row);
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
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
    .where(
      and(
        eq(variantParts.partId, params.partId),
        eq(variantParts.ownerId, resolveTrustedOwnerId())
      )
    )
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
    .where(
      and(
        eq(variantParts.partId, params.partId),
        eq(variantParts.ownerId, resolveTrustedOwnerId())
      )
    );
}

export async function getPartPayloadTextById(params: {
  partId: string;
}): Promise<string | null> {
  const db = await initDb();
  const rows = await db
    .select({ payloadJson: variantParts.payloadJson })
    .from(variantParts)
    .where(
      and(
        eq(variantParts.partId, params.partId),
        eq(variantParts.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);

  const existing = safeJsonParse<StoredPayload | null>(rows[0]?.payloadJson, null);
  if (!existing) return null;
  if (typeof existing.value === "string") return existing.value;
  return safeJsonStringify(existing.value, "");
}

export async function getPartById(params: {
  partId: string;
}): Promise<Part | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(variantParts)
    .where(
      and(
        eq(variantParts.partId, params.partId),
        eq(variantParts.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  const row = rows[0];
  return row ? partRowToDomain(row) : null;
}

export async function getPartWithVariantContextById(params: {
  partId: string;
}): Promise<
  | {
      part: Part;
      ownerId: string;
      variantId: string;
      entryId: string;
    }
  | null
> {
  const db = await initDb();
  const partRows = await db
    .select()
    .from(variantParts)
    .where(
      and(
        eq(variantParts.partId, params.partId),
        eq(variantParts.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  const partRow = partRows[0];
  if (!partRow) return null;

  const variantRows = await db
    .select({
      variantId: entryVariants.variantId,
      entryId: entryVariants.entryId,
    })
    .from(entryVariants)
    .where(
      and(
        eq(entryVariants.variantId, partRow.variantId),
        eq(entryVariants.ownerId, resolveTrustedOwnerId())
      )
    )
    .limit(1);
  const variant = variantRows[0];
  if (!variant) return null;

  return {
    part: partRowToDomain(partRow),
    ownerId: partRow.ownerId,
    variantId: partRow.variantId,
    entryId: variant.entryId,
  };
}

type ApplyManualEditToPartParams = {
  partId: string;
  payloadText: string;
  payloadFormat?: PartPayloadFormat;
  requestId?: string;
  executor?: DbExecutor;
};

export function applyManualEditToPart(
  params: ApplyManualEditToPartParams & { executor: DbExecutor }
): void;
export function applyManualEditToPart(params: ApplyManualEditToPartParams): Promise<void>;
export function applyManualEditToPart(
  params: ApplyManualEditToPartParams
): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    const rows = db
      .select({ payloadJson: variantParts.payloadJson })
      .from(variantParts)
      .where(
        and(
          eq(variantParts.partId, params.partId),
          eq(variantParts.ownerId, resolveTrustedOwnerId())
        )
      )
      .limit(1)
      .all();

    const existing = safeJsonParse<StoredPayload>(rows[0]?.payloadJson, {
      format: "text",
      value: "",
    });

    const payload: StoredPayload = {
      ...existing,
      format: params.payloadFormat ?? existing.format ?? "markdown",
      value: params.payloadText,
    };

    db
      .update(variantParts)
      .set({
        payloadJson: safeJsonStringify(payload),
        source: "user",
        agentId: null,
        model: null,
        requestId: params.requestId ?? null,
      })
      .where(
        and(
          eq(variantParts.partId, params.partId),
          eq(variantParts.ownerId, resolveTrustedOwnerId())
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

type SoftDeletePartParams = {
  partId: string;
  by: "user" | "agent";
  executor?: DbExecutor;
};

export function softDeletePart(params: SoftDeletePartParams & { executor: DbExecutor }): void;
export function softDeletePart(params: SoftDeletePartParams): Promise<void>;
export function softDeletePart(params: SoftDeletePartParams): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    db
      .update(variantParts)
      .set({
        softDeleted: true,
        softDeletedAt: new Date(),
        softDeletedBy: params.by,
      })
      .where(
        and(
          eq(variantParts.partId, params.partId),
          eq(variantParts.ownerId, resolveTrustedOwnerId())
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function updatePartReplacesPartId(params: {
  partId: string;
  replacesPartId: string | null;
}): Promise<void> {
  const db = await initDb();
  await db
    .update(variantParts)
    .set({ replacesPartId: params.replacesPartId })
    .where(
      and(
        eq(variantParts.partId, params.partId),
        eq(variantParts.ownerId, resolveTrustedOwnerId())
      )
    );
}

export type PartMutableBatchPatch = {
  partId: string;
  channel: PartChannel;
  order: number;
  payload: string | object | number | boolean | null;
  payloadFormat: PartPayloadFormat;
  schemaId?: string;
  label?: string;
  visibility: PartVisibility;
  replacesPartId: string | null;
  softDeleted: boolean;
  softDeletedAt?: number | null;
  softDeletedBy?: "user" | "agent" | null;
};

export type PartMutableBatchCreate = Omit<CreatePartParams, "executor" | "ownerId" | "variantId"> & {
  clientPartId: string;
};

export type PartMutableBatchApplyResult = {
  createdParts: Array<{ clientPartId: string; partId: string }>;
};

export async function applyPartMutableBatchPatches(params: {
  variantId: string;
  patches: PartMutableBatchPatch[];
  creates?: PartMutableBatchCreate[];
  deletePartIds?: string[];
}): Promise<PartMutableBatchApplyResult> {
  const db = await initDb();
  const createdParts: Array<{ clientPartId: string; partId: string }> = [];

  await db.transaction((tx) => {
    for (const partId of params.deletePartIds ?? []) {
      tx
        .delete(variantParts)
        .where(
          and(
            eq(variantParts.partId, partId),
            eq(variantParts.variantId, params.variantId),
            eq(variantParts.ownerId, resolveTrustedOwnerId())
          )
        )
        .run();
    }

    for (const patch of params.patches) {
      tx
        .update(variantParts)
        .set({
          channel: patch.channel,
          order: patch.order,
          payloadJson: safeJsonStringify({
            format: patch.payloadFormat,
            value: patch.payload,
            schemaId: patch.schemaId,
            label: patch.label,
          } satisfies StoredPayload),
          visibilityJson: safeJsonStringify(patch.visibility),
          replacesPartId: patch.replacesPartId,
          softDeleted: patch.softDeleted,
          softDeletedAt:
            patch.softDeleted && typeof patch.softDeletedAt === "number"
              ? new Date(patch.softDeletedAt)
              : null,
          softDeletedBy: patch.softDeleted ? patch.softDeletedBy ?? "user" : null,
        })
        .where(
          and(
            eq(variantParts.partId, patch.partId),
            eq(variantParts.variantId, params.variantId),
            eq(variantParts.ownerId, resolveTrustedOwnerId())
          )
        )
        .run();
    }

    for (const create of params.creates ?? []) {
      const created = createPart({
        ...create,
        variantId: params.variantId,
        executor: tx,
      });
      createdParts.push({ clientPartId: create.clientPartId, partId: created.partId });
    }
  });

  return { createdParts };
}

