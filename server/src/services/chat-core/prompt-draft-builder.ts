import crypto from "crypto";

import type { GenerateMessage } from "@shared/types/generate";
import type { PromptDraft, PromptDraftMessage } from "@shared/types/pipeline-execution";

import { listMessagesForPrompt } from "./chats-repository";
import { listLatestPersistedArtifactsForSession, type PipelineArtifactDto } from "./pipeline-artifacts-repository";

export type PromptTrimmingSummary = {
  historyLimit: number;
  excludedMessageIdsCount: number;
  historyReturnedCount: number;
};

export type PromptSnapshotV1 = {
  v: 1;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  truncated: boolean;
  meta: {
    historyLimit: number;
    historyReturnedCount: number;
  };
};

export type BuiltPromptDraft = {
  draft: PromptDraft;
  llmMessages: GenerateMessage[];
  trimming: PromptTrimmingSummary;
  promptHash: string;
  promptSnapshot: PromptSnapshotV1;
  artifactInclusions: Array<{
    tag: string;
    version: number;
    mode: PromptInclusionModeV1;
    role: "system" | "developer" | "user" | "assistant";
    format: "text" | "json" | "markdown";
    contentType: string;
    visibility: string;
    uiSurface: string;
    writerPipelineId: string | null;
    writerStepName: string | null;
  }>;
};

type PromptInclusionModeV1 =
  | "none"
  | "prepend_system"
  | "append_after_last_user"
  | "as_message";

type PromptInclusionV1 = {
  mode: PromptInclusionModeV1;
  role?: "system" | "developer" | "user" | "assistant";
  format?: "text" | "json" | "markdown";
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parsePromptInclusionV1(v: unknown): PromptInclusionV1 | null {
  if (!isRecord(v)) return null;
  const mode = v.mode;
  if (
    mode !== "none" &&
    mode !== "prepend_system" &&
    mode !== "append_after_last_user" &&
    mode !== "as_message"
  ) {
    return null;
  }
  const roleRaw = v.role;
  const role =
    roleRaw === "system" ||
    roleRaw === "developer" ||
    roleRaw === "user" ||
    roleRaw === "assistant"
      ? roleRaw
      : undefined;
  const formatRaw = v.format;
  const format =
    formatRaw === "text" || formatRaw === "json" || formatRaw === "markdown"
      ? formatRaw
      : undefined;
  return { mode, role, format };
}

function artifactToText(a: PipelineArtifactDto, inclusion: PromptInclusionV1): string {
  const format = inclusion.format ?? (a.contentType === "markdown" ? "markdown" : a.contentType === "text" ? "text" : "json");
  if (format === "json") {
    if (a.contentType === "json") {
      try {
        return JSON.stringify(a.contentJson ?? null);
      } catch {
        return "{}";
      }
    }
    // Coerce text/markdown to json string value.
    return JSON.stringify(a.contentText ?? "");
  }
  // text/markdown: use textual representation.
  if (a.contentType === "json") {
    try {
      return JSON.stringify(a.contentJson ?? null);
    } catch {
      return "{}";
    }
  }
  return String(a.contentText ?? "");
}

type ArtifactOrderingContext = {
  pipelineOrderById: Map<string, number>;
};

function stepTypeOrder(stepName: string | null | undefined): number {
  if (stepName === "pre") return 0;
  if (stepName === "llm") return 1;
  if (stepName === "post") return 2;
  return 99;
}

function compareArtifactsForPrompt(a: PipelineArtifactDto, b: PipelineArtifactDto, ctx: ArtifactOrderingContext): number {
  const aPipe = a.writerPipelineId ? (ctx.pipelineOrderById.get(a.writerPipelineId) ?? 999) : 999;
  const bPipe = b.writerPipelineId ? (ctx.pipelineOrderById.get(b.writerPipelineId) ?? 999) : 999;
  if (aPipe !== bPipe) return aPipe - bPipe;

  const aStep = stepTypeOrder(a.writerStepName);
  const bStep = stepTypeOrder(b.writerStepName);
  if (aStep !== bStep) return aStep - bStep;

  if (a.tag !== b.tag) return a.tag < b.tag ? -1 : 1;
  if (a.version !== b.version) return a.version - b.version;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function extractPipelineOrderFromProfileSpec(spec: unknown): Map<string, number> {
  // v1: shared type shape: { spec_version: 1, pipelines: [{ id: string, ...}] }
  if (!isRecord(spec)) return new Map();
  if (spec.spec_version !== 1) return new Map();
  const pipelines = (spec as any).pipelines;
  if (!Array.isArray(pipelines)) return new Map();
  const map = new Map<string, number>();
  pipelines.forEach((p: unknown, idx: number) => {
    if (!isRecord(p)) return;
    const id = (p as any).id;
    if (typeof id === "string" && id.trim()) map.set(id, idx);
  });
  return map;
}

function normalizeDraftMessage(msg: PromptDraftMessage): PromptDraftMessage | null {
  const content = typeof msg.content === "string" ? msg.content : "";
  const normalized = content.trim();
  if (!normalized) return null;
  return { role: msg.role, content: normalized };
}

function draftToLlmMessages(draft: PromptDraft): GenerateMessage[] {
  // v1 rule: map developer -> system for the actual LLM API.
  return (draft.messages ?? [])
    .map(normalizeDraftMessage)
    .filter((m): m is PromptDraftMessage => Boolean(m))
    .map((m) => ({
      role: (m.role === "developer" ? "system" : m.role) as GenerateMessage["role"],
      content: m.content,
    }));
}

function hashPromptMessages(messages: GenerateMessage[]): string {
  // Stable enough in v1: JSON array with ordered entries.
  const payload = JSON.stringify(messages);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function buildRedactedSnapshot(messages: GenerateMessage[], params: {
  historyLimit: number;
  historyReturnedCount: number;
}): PromptSnapshotV1 {
  const MAX_MSG_CHARS = 4_000;
  const MAX_TOTAL_CHARS = 50_000;

  let total = 0;
  let truncated = false;

  const snapshotMessages: PromptSnapshotV1["messages"] = [];

  for (const m of messages) {
    let content = m.content ?? "";
    if (content.length > MAX_MSG_CHARS) {
      content = `${content.slice(0, MAX_MSG_CHARS)}…`;
      truncated = true;
    }
    if (total + content.length > MAX_TOTAL_CHARS) {
      const remaining = Math.max(0, MAX_TOTAL_CHARS - total);
      content = remaining > 0 ? `${content.slice(0, remaining)}…` : "…";
      truncated = true;
    }

    total += content.length;
    snapshotMessages.push({ role: m.role, content });

    if (total >= MAX_TOTAL_CHARS) break;
  }

  return {
    v: 1,
    messages: snapshotMessages,
    truncated,
    meta: {
      historyLimit: params.historyLimit,
      historyReturnedCount: params.historyReturnedCount,
    },
  };
}

export async function buildPromptDraft(params: {
  ownerId?: string;
  chatId: string;
  branchId: string;
  systemPrompt: string;
  historyLimit?: number;
  excludeMessageIds?: string[];
  /**
   * Optional active PipelineProfile spec (v1) to provide deterministic ordering
   * for prompt inclusions (PipelineProfile order -> step order -> tag -> version).
   */
  activeProfileSpec?: unknown;
}): Promise<BuiltPromptDraft> {
  const ownerId = params.ownerId ?? "global";
  const historyLimit = params.historyLimit ?? 50;
  const exclude = params.excludeMessageIds ?? [];

  const history = await listMessagesForPrompt({
    chatId: params.chatId,
    branchId: params.branchId,
    limit: historyLimit,
    excludeMessageIds: exclude,
  });

  // --- Phase 4 (v1 minimal): artifacts -> promptInclusion
  const artifacts = await listLatestPersistedArtifactsForSession({
    ownerId,
    sessionId: params.chatId,
  });

  const orderingCtx: ArtifactOrderingContext = {
    pipelineOrderById: extractPipelineOrderFromProfileSpec(params.activeProfileSpec),
  };

  const inclusions = artifacts
    .filter((a) => a.visibility === "prompt_only" || a.visibility === "prompt_and_ui")
    .map((a) => ({ artifact: a, inclusion: parsePromptInclusionV1(a.promptInclusion) }))
    .filter((x): x is { artifact: PipelineArtifactDto; inclusion: PromptInclusionV1 } => Boolean(x.inclusion && x.inclusion.mode !== "none"))
    .sort((x, y) => compareArtifactsForPrompt(x.artifact, y.artifact, orderingCtx));

  let systemPrompt = params.systemPrompt ?? "";

  const artifactInclusions = inclusions.map(({ artifact, inclusion }) => ({
    tag: artifact.tag,
    version: artifact.version,
    mode: inclusion.mode,
    role: inclusion.role ?? "developer",
    format:
      inclusion.format ??
      (artifact.contentType === "markdown"
        ? "markdown"
        : artifact.contentType === "text"
          ? "text"
          : "json"),
    contentType: artifact.contentType,
    visibility: artifact.visibility,
    uiSurface: artifact.uiSurface,
    writerPipelineId: artifact.writerPipelineId ?? null,
    writerStepName: artifact.writerStepName ?? null,
  }));

  const timelineInsertsAfterLastUser: PromptDraftMessage[] = [];
  const tailMessages: PromptDraftMessage[] = [];

  for (const { artifact, inclusion } of inclusions) {
    const role = inclusion.role ?? "developer";
    const content = artifactToText(artifact, inclusion);
    if (!content.trim()) continue;

    if (inclusion.mode === "prepend_system") {
      // Apply in deterministic order: earlier items go closer to the start.
      systemPrompt = `${content}\n\n${systemPrompt}`;
      continue;
    }
    if (inclusion.mode === "append_after_last_user") {
      timelineInsertsAfterLastUser.push({ role, content });
      continue;
    }
    // as_message: v1 minimal = append to tail.
    tailMessages.push({ role, content });
  }

  const draft: PromptDraft = {
    messages: [
      { role: "system", content: systemPrompt },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  if (timelineInsertsAfterLastUser.length > 0) {
    // Find the last user message (excluding the system prompt at index 0).
    let lastUserIdx = -1;
    for (let i = draft.messages.length - 1; i >= 1; i--) {
      if (draft.messages[i]?.role === "user") {
        lastUserIdx = i;
        break;
      }
    }
    const insertAt = lastUserIdx >= 1 ? lastUserIdx + 1 : draft.messages.length;
    draft.messages.splice(insertAt, 0, ...timelineInsertsAfterLastUser);
  }
  if (tailMessages.length > 0) {
    draft.messages.push(...tailMessages);
  }

  const llmMessages = draftToLlmMessages(draft);
  const promptHash = hashPromptMessages(llmMessages);

  const trimming: PromptTrimmingSummary = {
    historyLimit,
    excludedMessageIdsCount: exclude.length,
    historyReturnedCount: history.length,
  };

  const promptSnapshot = buildRedactedSnapshot(llmMessages, {
    historyLimit,
    historyReturnedCount: history.length,
  });

  return { draft, llmMessages, trimming, promptHash, promptSnapshot, artifactInclusions };
}

