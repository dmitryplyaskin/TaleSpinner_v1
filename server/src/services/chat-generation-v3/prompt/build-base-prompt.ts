import { buildPromptDraft } from "../../chat-core/prompt-draft-builder";
import {
  buildPromptTemplateRenderContext,
  hasWorldInfoTemplatePlaceholders,
  resolveAndApplyWorldInfoToTemplateContext,
} from "../../chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../../chat-core/prompt-template-renderer";
import { pickPromptTemplateForChat } from "../../chat-core/prompt-templates-repository";

import type { PromptBuildOutput } from "../contracts";
import type { OperationTrigger } from "@shared/types/operation-profiles";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

function mapWorldInfoRole(role: number): "system" | "user" | "assistant" {
  if (role === 1) return "user";
  if (role === 2) return "assistant";
  return "system";
}

export async function buildBasePrompt(params: {
  ownerId: string;
  chatId: string;
  branchId: string;
  entityProfileId: string;
  historyLimit: number;
  trigger: OperationTrigger;
  scanSeed?: string;
  excludeMessageIds?: string[];
  excludeEntryIds?: string[];
}): Promise<{ prompt: PromptBuildOutput; templateContext: Awaited<ReturnType<typeof buildPromptTemplateRenderContext>> }> {
  const templateContext = await buildPromptTemplateRenderContext({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    entityProfileId: params.entityProfileId,
    historyLimit: params.historyLimit,
    excludeMessageIds: params.excludeMessageIds,
    excludeEntryIds: params.excludeEntryIds,
  });

  let worldInfoBefore = "";
  let worldInfoAfter = "";
  let worldInfoWarnings: string[] = [];
  let worldInfoDepthInsertions: Array<{
    depth: number;
    role: "system" | "user" | "assistant";
    content: string;
  }> = [];
  let worldInfoActivatedCount = 0;
  const resolvedWorldInfo = await resolveAndApplyWorldInfoToTemplateContext({
    context: templateContext,
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    entityProfileId: params.entityProfileId,
    trigger: params.trigger,
    scanSeed:
      params.scanSeed ??
      `${params.ownerId}:${params.chatId}:${params.branchId}:${params.trigger}:${Date.now()}`,
    dryRun: false,
  });
  worldInfoBefore = resolvedWorldInfo.worldInfoBefore;
  worldInfoAfter = resolvedWorldInfo.worldInfoAfter;
  worldInfoWarnings = resolvedWorldInfo.warnings;
  worldInfoActivatedCount = resolvedWorldInfo.activatedCount;
  worldInfoDepthInsertions = resolvedWorldInfo.depthEntries
    .map((entry) => ({
      depth: Math.max(0, Math.floor(entry.depth)),
      role: mapWorldInfoRole(entry.role),
      content: entry.content,
    }))
    .filter((entry) => entry.content.trim().length > 0);

  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  let hasExplicitWorldInfoPlaceholders = false;
  try {
    const template = await pickPromptTemplateForChat({
      ownerId: params.ownerId,
      chatId: params.chatId,
    });
    if (template) {
      hasExplicitWorldInfoPlaceholders = hasWorldInfoTemplatePlaceholders(
        template.templateText
      );
      const rendered = await renderLiquidTemplate({
        templateText: template.templateText,
        context: templateContext,
      });
      const normalized = rendered.trim();
      if (normalized) systemPrompt = normalized;
    }
  } catch {
    // Keep default fallback.
  }

  const shouldAutoInjectBeforeAfter = !hasExplicitWorldInfoPlaceholders;

  const builtPrompt = await buildPromptDraft({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    systemPrompt,
    historyLimit: params.historyLimit,
    excludeMessageIds: params.excludeMessageIds,
    excludeEntryIds: params.excludeEntryIds,
    trigger: params.trigger,
    preHistorySystemMessages:
      shouldAutoInjectBeforeAfter && worldInfoBefore ? [worldInfoBefore] : [],
    postHistorySystemMessages:
      shouldAutoInjectBeforeAfter && worldInfoAfter ? [worldInfoAfter] : [],
    depthInsertions: worldInfoDepthInsertions,
    worldInfoMeta: {
      activatedCount: worldInfoActivatedCount,
      beforeChars: worldInfoBefore.length,
      afterChars: worldInfoAfter.length,
      warnings: worldInfoWarnings,
    },
    activeProfileSpec: null,
  });

  return {
    prompt: {
      systemPrompt,
      historyReturnedCount: builtPrompt.trimming.historyReturnedCount,
      promptHash: builtPrompt.promptHash,
      promptSnapshot: builtPrompt.promptSnapshot,
      llmMessages: builtPrompt.llmMessages,
      draftMessages: builtPrompt.draft.messages,
    },
    templateContext,
  };
}
