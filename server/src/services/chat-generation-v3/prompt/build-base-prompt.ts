import { buildPromptDraft } from "../../chat-core/prompt-draft-builder";
import { buildPromptTemplateRenderContext } from "../../chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../../chat-core/prompt-template-renderer";
import { pickPromptTemplateForChat } from "../../chat-core/prompt-templates-repository";
import { resolveWorldInfoRuntime } from "../../world-info/world-info-runtime";

import type { OperationTrigger } from "@shared/types/operation-profiles";

import type { PromptBuildOutput } from "../contracts";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

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
  try {
    const resolved = await resolveWorldInfoRuntime({
      ownerId: params.ownerId,
      chatId: params.chatId,
      branchId: params.branchId,
      entityProfileId: params.entityProfileId,
      trigger: params.trigger,
      history: templateContext.messages,
      scanSeed:
        params.scanSeed ??
        `${params.ownerId}:${params.chatId}:${params.branchId}:${params.trigger}:${Date.now()}`,
      dryRun: false,
    });
    worldInfoBefore = resolved.worldInfoBefore;
    worldInfoAfter = resolved.worldInfoAfter;
    worldInfoWarnings = resolved.debug.warnings;
  } catch {
    // Keep generation flow resilient when WI is unavailable.
  }

  templateContext.wiBefore = worldInfoBefore;
  templateContext.wiAfter = worldInfoAfter;
  templateContext.loreBefore = worldInfoBefore;
  templateContext.loreAfter = worldInfoAfter;
  templateContext.anchorBefore = worldInfoBefore;
  templateContext.anchorAfter = worldInfoAfter;

  let systemPrompt = DEFAULT_SYSTEM_PROMPT;
  try {
    const template = await pickPromptTemplateForChat({
      ownerId: params.ownerId,
      chatId: params.chatId,
    });
    if (template) {
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

  const builtPrompt = await buildPromptDraft({
    ownerId: params.ownerId,
    chatId: params.chatId,
    branchId: params.branchId,
    systemPrompt,
    historyLimit: params.historyLimit,
    excludeMessageIds: params.excludeMessageIds,
    excludeEntryIds: params.excludeEntryIds,
    trigger: params.trigger,
    preHistorySystemMessages: worldInfoBefore ? [worldInfoBefore] : [],
    postHistorySystemMessages: worldInfoAfter ? [worldInfoAfter] : [],
    worldInfoMeta: {
      activatedCount: Number(Boolean(worldInfoBefore)) + Number(Boolean(worldInfoAfter)),
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
