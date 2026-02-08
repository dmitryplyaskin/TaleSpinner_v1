import crypto from "crypto";

import type { GenerateMessage } from "@shared/types/generate";
import type { OperationTrigger } from "@shared/types/operation-profiles";

import { listMessagesForPrompt } from "./chats-repository";
import { listProjectedPromptMessages } from "../chat-entry-parts/prompt-history";

type PromptDraftRole = "system" | "developer" | "user" | "assistant";

type PromptDraftMessage = {
  role: PromptDraftRole;
  content: string;
};

type PromptDraft = {
  messages: PromptDraftMessage[];
};

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
    worldInfo?: {
      activatedCount: number;
      beforeChars: number;
      afterChars: number;
      warnings: string[];
    };
  };
};

export type BuiltPromptDraft = {
  draft: PromptDraft;
  llmMessages: GenerateMessage[];
  trimming: PromptTrimmingSummary;
  promptHash: string;
  promptSnapshot: PromptSnapshotV1;
  artifactInclusions: Array<{
    // Legacy field kept for API compatibility; always empty without pipelines.
    tag: string;
    version: number;
    mode: "none";
    role: PromptDraftRole;
    format: "text" | "json" | "markdown";
    contentType: string;
    visibility: string;
    uiSurface: string;
    writerPipelineId: string | null;
    writerStepName: string | null;
  }>;
};

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
  worldInfoMeta?: PromptSnapshotV1["meta"]["worldInfo"];
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
      worldInfo: params.worldInfoMeta,
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
  excludeEntryIds?: string[];
  preHistorySystemMessages?: string[];
  postHistorySystemMessages?: string[];
  worldInfoMeta?: PromptSnapshotV1["meta"]["worldInfo"];
  /**
   * Optional active PipelineProfile spec (v1) to provide deterministic ordering
   * for prompt inclusions (PipelineProfile order -> step order -> tag -> version).
   */
  activeProfileSpec?: unknown;
  trigger?: OperationTrigger;
}): Promise<BuiltPromptDraft> {
  const historyLimit = params.historyLimit ?? 50;
  const exclude = params.excludeMessageIds ?? [];

  let history: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
  let usedEntries = false;
  try {
    const projected = await listProjectedPromptMessages({
      chatId: params.chatId,
      branchId: params.branchId,
      limit: historyLimit,
      excludeEntryIds: params.excludeEntryIds,
    });
    if (projected.entryCount > 0) {
      usedEntries = true;
      history = projected.messages.map((m) => ({ role: m.role, content: m.content }));
    }
  } catch {
    // best-effort: fall back to legacy history below
  }

  if (!usedEntries) {
    history = await listMessagesForPrompt({
      chatId: params.chatId,
      branchId: params.branchId,
      limit: historyLimit,
      excludeMessageIds: exclude,
    });
  }
  // Pipelines/artifacts were removed. Keep prompt drafting minimal and deterministic.
  const systemPrompt = params.systemPrompt ?? "";

  const draft: PromptDraft = {
    messages: [
      { role: "system", content: systemPrompt },
      ...(params.preHistorySystemMessages ?? []).map((content) => ({
        role: "system" as const,
        content,
      })),
      ...history.map((m) => ({ role: m.role, content: m.content })),
      ...(params.postHistorySystemMessages ?? []).map((content) => ({
        role: "system" as const,
        content,
      })),
    ],
  };

  void params.ownerId;
  void params.activeProfileSpec;
  void params.trigger;

  const llmMessages = draftToLlmMessages(draft);
  const promptHash = hashPromptMessages(llmMessages);

  const trimming: PromptTrimmingSummary = {
    historyLimit,
    excludedMessageIdsCount: usedEntries
      ? (params.excludeEntryIds ?? []).length
      : exclude.length,
    historyReturnedCount: history.length,
  };

  const promptSnapshot = buildRedactedSnapshot(llmMessages, {
    historyLimit,
    historyReturnedCount: history.length,
    worldInfoMeta: params.worldInfoMeta,
  });

  return { draft, llmMessages, trimming, promptHash, promptSnapshot, artifactInclusions: [] };
}

