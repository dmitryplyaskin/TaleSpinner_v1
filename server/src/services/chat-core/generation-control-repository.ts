import { and, eq } from "drizzle-orm";

import { resolveTrustedOwnerId } from "../../core/request-context/owner-scope-storage";
import { type DbExecutor, initDb } from "../../db/client";
import { generationRuntimeControl, llmGenerations } from "../../db/schema";

export type GenerationControlStatus = "active" | "abort_requested";

export type GenerationControlRecord = {
  generationId: string;
  runInstanceId: string;
  status: GenerationControlStatus;
  abortRequestedAt: Date | null;
  heartbeatAt: Date;
  leaseExpiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

function rowToRecord(
  row: typeof generationRuntimeControl.$inferSelect
): GenerationControlRecord {
  return {
    generationId: row.generationId,
    runInstanceId: row.runInstanceId,
    status: row.status,
    abortRequestedAt: row.abortRequestedAt ?? null,
    heartbeatAt: row.heartbeatAt,
    leaseExpiresAt: row.leaseExpiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isOwnedGeneration(db: DbExecutor, generationId: string): boolean {
  return Boolean(
    db
      .select({ id: llmGenerations.id })
      .from(llmGenerations)
      .where(
        and(
          eq(llmGenerations.id, generationId),
          eq(llmGenerations.ownerId, resolveTrustedOwnerId())
        )
      )
      .limit(1)
      .get()
  );
}

type UpsertGenerationControlLeaseParams = {
  generationId: string;
  runInstanceId: string;
  heartbeatAt: Date;
  leaseExpiresAt: Date;
  executor?: DbExecutor;
};

export function upsertGenerationControlLease(
  params: UpsertGenerationControlLeaseParams & { executor: DbExecutor }
): void;
export function upsertGenerationControlLease(
  params: UpsertGenerationControlLeaseParams
): Promise<void>;
export function upsertGenerationControlLease(
  params: UpsertGenerationControlLeaseParams
): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    if (!isOwnedGeneration(db, params.generationId)) return;
    db.insert(generationRuntimeControl)
      .values({
        generationId: params.generationId,
        runInstanceId: params.runInstanceId,
        status: "active",
        abortRequestedAt: null,
        heartbeatAt: params.heartbeatAt,
        leaseExpiresAt: params.leaseExpiresAt,
        createdAt: params.heartbeatAt,
        updatedAt: params.heartbeatAt,
      })
      .onConflictDoUpdate({
        target: generationRuntimeControl.generationId,
        set: {
          runInstanceId: params.runInstanceId,
          status: "active",
          abortRequestedAt: null,
          heartbeatAt: params.heartbeatAt,
          leaseExpiresAt: params.leaseExpiresAt,
          updatedAt: params.heartbeatAt,
        },
      })
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

type HeartbeatGenerationControlLeaseParams = {
  generationId: string;
  runInstanceId: string;
  heartbeatAt: Date;
  leaseExpiresAt: Date;
  executor?: DbExecutor;
};

export function heartbeatGenerationControlLease(
  params: HeartbeatGenerationControlLeaseParams & { executor: DbExecutor }
): void;
export function heartbeatGenerationControlLease(
  params: HeartbeatGenerationControlLeaseParams
): Promise<void>;
export function heartbeatGenerationControlLease(
  params: HeartbeatGenerationControlLeaseParams
): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    if (!isOwnedGeneration(db, params.generationId)) return;
    db.update(generationRuntimeControl)
      .set({
        heartbeatAt: params.heartbeatAt,
        leaseExpiresAt: params.leaseExpiresAt,
        updatedAt: params.heartbeatAt,
      })
      .where(
        and(
          eq(generationRuntimeControl.generationId, params.generationId),
          eq(generationRuntimeControl.runInstanceId, params.runInstanceId)
        )
      )
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

export async function getGenerationControlByGenerationId(
  generationId: string
): Promise<GenerationControlRecord | null> {
  const db = await initDb();
  if (!isOwnedGeneration(db, generationId)) return null;
  const rows = await db
    .select()
    .from(generationRuntimeControl)
    .where(eq(generationRuntimeControl.generationId, generationId))
    .limit(1);
  return rows[0] ? rowToRecord(rows[0]) : null;
}

type MarkGenerationAbortRequestedParams = {
  generationId: string;
  requestedAt: Date;
  executor?: DbExecutor;
};

export function markGenerationAbortRequested(
  params: MarkGenerationAbortRequestedParams & { executor: DbExecutor }
): void;
export function markGenerationAbortRequested(
  params: MarkGenerationAbortRequestedParams
): Promise<void>;
export function markGenerationAbortRequested(
  params: MarkGenerationAbortRequestedParams
): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    if (!isOwnedGeneration(db, params.generationId)) return;
    db.update(generationRuntimeControl)
      .set({
        status: "abort_requested",
        abortRequestedAt: params.requestedAt,
        updatedAt: params.requestedAt,
      })
      .where(eq(generationRuntimeControl.generationId, params.generationId))
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}

type ClearGenerationControlLeaseParams = {
  generationId: string;
  executor?: DbExecutor;
};

export function clearGenerationControlLease(
  params: ClearGenerationControlLeaseParams & { executor: DbExecutor }
): void;
export function clearGenerationControlLease(
  params: ClearGenerationControlLeaseParams
): Promise<void>;
export function clearGenerationControlLease(
  params: ClearGenerationControlLeaseParams
): Promise<void> | void {
  const run = (db: DbExecutor): void => {
    if (!isOwnedGeneration(db, params.generationId)) return;
    db.delete(generationRuntimeControl)
      .where(eq(generationRuntimeControl.generationId, params.generationId))
      .run();
  };

  if (params.executor) {
    return run(params.executor);
  }

  return initDb().then((db) => run(db));
}
