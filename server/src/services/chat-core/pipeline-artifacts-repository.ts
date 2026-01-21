import { and, asc, desc, eq, lt } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

import { safeJsonParse, safeJsonStringify } from "../../chat-core/json";
import { initDb } from "../../db/client";
import { pipelineArtifacts } from "../../db/schema";
import { HttpError } from "@core/middleware/error-handler";

export type PipelineArtifactAccess = "persisted" | "run_only";
export type PipelineArtifactVisibility =
  | "prompt_only"
  | "ui_only"
  | "prompt_and_ui"
  | "internal";

export type PipelineArtifactContentType = "text" | "json" | "markdown";

export type PipelineArtifactDto = {
  id: string;
  ownerId: string;
  sessionId: string;
  tag: string;
  kind: string;
  access: PipelineArtifactAccess;
  visibility: PipelineArtifactVisibility;
  uiSurface: string;
  contentType: PipelineArtifactContentType;
  contentJson: unknown | null;
  contentText: string | null;
  promptInclusion: unknown | null;
  retentionPolicy: unknown | null;
  version: number;
  basedOnVersion: number | null;
  writerPipelineId: string | null;
  writerStepName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function rowToDto(row: typeof pipelineArtifacts.$inferSelect): PipelineArtifactDto {
  return {
    id: row.id,
    ownerId: row.ownerId,
    sessionId: row.sessionId,
    tag: row.tag,
    kind: row.kind,
    access: row.access,
    visibility: row.visibility,
    uiSurface: row.uiSurface,
    contentType: row.contentType,
    contentJson: safeJsonParse(row.contentJson, null),
    contentText: row.contentText ?? null,
    promptInclusion: safeJsonParse(row.promptInclusionJson, null),
    retentionPolicy: safeJsonParse(row.retentionPolicyJson, null),
    version: row.version,
    basedOnVersion: row.basedOnVersion ?? null,
    writerPipelineId: row.writerPipelineId ?? null,
    writerStepName: row.writerStepName ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listPersistedArtifactVersions(params: {
  ownerId?: string;
  sessionId: string;
  tag: string;
  // Newest first.
  limit?: number;
  // Optional upper bound (exclusive): list versions strictly less than this.
  beforeVersion?: number;
}): Promise<PipelineArtifactDto[]> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";
  const limit = params.limit ?? 50;

  const rows = await db
    .select()
    .from(pipelineArtifacts)
    .where(
      and(
        eq(pipelineArtifacts.ownerId, ownerId),
        eq(pipelineArtifacts.sessionId, params.sessionId),
        eq(pipelineArtifacts.access, "persisted"),
        eq(pipelineArtifacts.tag, params.tag),
        ...(typeof params.beforeVersion === "number"
          ? [lt(pipelineArtifacts.version, params.beforeVersion)]
          : [])
      )
    )
    .orderBy(desc(pipelineArtifacts.version), desc(pipelineArtifacts.createdAt))
    .limit(limit);

  return rows.map(rowToDto);
}

export async function getLatestPersistedArtifact(params: {
  ownerId?: string;
  sessionId: string;
  tag: string;
}): Promise<PipelineArtifactDto | null> {
  const rows = await listPersistedArtifactVersions({ ...params, limit: 1 });
  return rows[0] ?? null;
}

export async function listLatestPersistedArtifactsForSession(params: {
  ownerId?: string;
  sessionId: string;
}): Promise<PipelineArtifactDto[]> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";

  // v1: keep it simple and deterministic: select all rows ordered by (tag asc, version desc),
  // then pick the first row per tag.
  const rows = await db
    .select()
    .from(pipelineArtifacts)
    .where(
      and(
        eq(pipelineArtifacts.ownerId, ownerId),
        eq(pipelineArtifacts.sessionId, params.sessionId),
        eq(pipelineArtifacts.access, "persisted")
      )
    )
    .orderBy(asc(pipelineArtifacts.tag), desc(pipelineArtifacts.version), desc(pipelineArtifacts.createdAt));

  const seen = new Set<string>();
  const latest: PipelineArtifactDto[] = [];
  for (const r of rows) {
    if (seen.has(r.tag)) continue;
    seen.add(r.tag);
    latest.push(rowToDto(r));
  }
  return latest;
}

export type ArtifactWriteResult = {
  created: boolean;
  artifact: PipelineArtifactDto;
};

type WriterIdentity = {
  pipelineId: string;
  stepName: string;
};

/**
 * Creates a new persisted artifact version (optimistic concurrency + reject).
 *
 * v1 rules:
 * - single-writer per persisted tag (enforced via writerPipelineId).
 * - basedOnVersion must match latest.version (if provided), otherwise conflict.
 */
export async function writePersistedArtifact(params: {
  ownerId?: string;
  sessionId: string;
  tag: string;
  kind?: string;
  visibility?: PipelineArtifactVisibility;
  uiSurface?: string;
  contentType: PipelineArtifactContentType;
  content: { json?: unknown; text?: string };
  promptInclusion?: unknown;
  retentionPolicy?: unknown;
  basedOnVersion?: number | null;
  writer: WriterIdentity;
}): Promise<ArtifactWriteResult> {
  const db = await initDb();
  const ownerId = params.ownerId ?? "global";

  const latest = await getLatestPersistedArtifact({
    ownerId,
    sessionId: params.sessionId,
    tag: params.tag,
  });

  if (latest?.writerPipelineId && latest.writerPipelineId !== params.writer.pipelineId) {
    throw new HttpError(
      403,
      `Запись в art.${params.tag} запрещена: tag принадлежит другому пайплайну`,
      "pipeline_policy_error",
      { tag: params.tag, ownerPipelineId: latest.writerPipelineId }
    );
  }

  const expected = typeof params.basedOnVersion === "number" ? params.basedOnVersion : null;
  if (latest && expected !== null && latest.version !== expected) {
    throw new HttpError(
      409,
      `Конфликт версии артефакта art.${params.tag}: expected=${expected}, actual=${latest.version}`,
      "pipeline_artifact_conflict",
      { tag: params.tag, expected, actual: latest.version }
    );
  }

  const id = uuidv4();
  const now = new Date();
  const nextVersion = (latest?.version ?? 0) + 1;

  const contentJson =
    params.contentType === "json"
      ? safeJsonStringify(params.content.json ?? null)
      : null;
  const contentText =
    params.contentType === "text" || params.contentType === "markdown"
      ? String(params.content.text ?? "")
      : null;

  await db.insert(pipelineArtifacts).values({
    id,
    ownerId,
    sessionId: params.sessionId,
    tag: params.tag,
    kind: params.kind ?? "any",
    access: "persisted",
    visibility: params.visibility ?? "internal",
    uiSurface: params.uiSurface ?? "internal",
    contentType: params.contentType,
    contentJson,
    contentText,
    promptInclusionJson:
      typeof params.promptInclusion === "undefined"
        ? null
        : safeJsonStringify(params.promptInclusion),
    retentionPolicyJson:
      typeof params.retentionPolicy === "undefined"
        ? null
        : safeJsonStringify(params.retentionPolicy),
    version: nextVersion,
    basedOnVersion:
      typeof params.basedOnVersion === "number" ? params.basedOnVersion : null,
    writerPipelineId: params.writer.pipelineId,
    writerStepName: params.writer.stepName,
    createdAt: now,
    updatedAt: now,
  });

  // v1: minimal pruning for keep_last_n (best-effort, no hard dependency on retention schema).
  const retention = safeJsonParse<Record<string, unknown>>(
    typeof params.retentionPolicy === "undefined"
      ? null
      : safeJsonStringify(params.retentionPolicy),
    {}
  );
  if (retention && retention.mode === "keep_last_n") {
    const max = typeof retention.max === "number" ? retention.max : null;
    if (typeof max === "number" && max >= 0) {
      const minVersionToKeep = nextVersion - max;
      // Keep versions >= minVersionToKeep (so total kept versions = max + 1).
      await db
        .delete(pipelineArtifacts)
        .where(
          and(
            eq(pipelineArtifacts.ownerId, ownerId),
            eq(pipelineArtifacts.sessionId, params.sessionId),
            eq(pipelineArtifacts.tag, params.tag),
            lt(pipelineArtifacts.version, minVersionToKeep)
          )
        );
    }
  }

  const created = await getLatestPersistedArtifact({
    ownerId,
    sessionId: params.sessionId,
    tag: params.tag,
  });
  if (!created) {
    throw new Error("Failed to read back created artifact");
  }

  return { created: latest === null, artifact: created };
}

