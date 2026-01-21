import { safeJsonParse } from "../../chat-core/json";
import { listLatestPersistedArtifactsForSession, listPersistedArtifactVersions, type PipelineArtifactDto } from "./pipeline-artifacts-repository";

export type SessionViewArtifact = {
  /**
   * Current materialized value (art.<tag>.value).
   * - json: object/array/primitive
   * - text/markdown: string
   */
  value: unknown;
  /**
   * Previous values, excluding current value (art.<tag>.history[]).
   * Order: oldest -> newest (excluding current).
   */
  history: unknown[];
  /**
   * Non-breaking metadata (useful for future debug, but not required by Liquid templates).
   */
  meta: {
    tag: string;
    kind: string;
    version: number;
    visibility: string;
    uiSurface: string;
    contentType: string;
    updatedAt: string;
    writerPipelineId: string | null;
    writerStepName: string | null;
  };
};

export type SessionView = {
  art: Record<string, SessionViewArtifact>;
};

type RetentionPolicyV1 =
  | { mode: "overwrite" }
  | { mode: "keep_last_n"; max: number };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseRetentionPolicy(v: unknown): RetentionPolicyV1 {
  if (!isRecord(v)) return { mode: "overwrite" };
  const mode = v.mode;
  if (mode === "keep_last_n") {
    const max = typeof v.max === "number" ? v.max : 0;
    return { mode: "keep_last_n", max: Math.max(0, Math.floor(max)) };
  }
  return { mode: "overwrite" };
}

function artifactValue(a: PipelineArtifactDto): unknown {
  if (a.contentType === "json") return a.contentJson;
  return a.contentText ?? "";
}

export async function buildChatSessionView(params: {
  ownerId?: string;
  chatId: string;
}): Promise<SessionView> {
  const ownerId = params.ownerId ?? "global";

  const latest = await listLatestPersistedArtifactsForSession({
    ownerId,
    sessionId: params.chatId,
  });

  const art: Record<string, SessionViewArtifact> = {};

  for (const a of latest) {
    const retention = parseRetentionPolicy(a.retentionPolicy);
    const historyLimit = retention.mode === "keep_last_n" ? retention.max : 0;

    const historyValues: unknown[] = [];
    if (historyLimit > 0) {
      const prev = await listPersistedArtifactVersions({
        ownerId,
        sessionId: params.chatId,
        tag: a.tag,
        limit: historyLimit,
        beforeVersion: a.version,
      });
      // We fetched newest-first; Liquid-friendly order is oldest->newest (excluding current).
      for (const p of prev.slice().reverse()) {
        historyValues.push(artifactValue(p));
      }
    }

    art[a.tag] = {
      value: artifactValue(a),
      history: historyValues,
      meta: {
        tag: a.tag,
        kind: a.kind,
        version: a.version,
        visibility: a.visibility,
        uiSurface: a.uiSurface,
        contentType: a.contentType,
        updatedAt: a.updatedAt.toISOString(),
        writerPipelineId: a.writerPipelineId,
        writerStepName: a.writerStepName,
      },
    };
  }

  return { art };
}

/**
 * Best-effort helper for template context: never throws.
 */
export async function buildChatSessionViewSafe(params: {
  ownerId?: string;
  chatId: string;
}): Promise<SessionView> {
  try {
    return await buildChatSessionView(params);
  } catch {
    // If DB isn't migrated yet or anything else fails, keep templates functional.
    return { art: safeJsonParse(null, {}) as Record<string, SessionViewArtifact> };
  }
}

