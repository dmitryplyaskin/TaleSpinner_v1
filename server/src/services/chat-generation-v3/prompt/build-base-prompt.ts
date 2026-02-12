import { buildPromptDraft } from "../../chat-core/prompt-draft-builder";
import {
  buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext,
} from "../../chat-core/prompt-template-context";
import { renderLiquidTemplate } from "../../chat-core/prompt-template-renderer";
import { pickPromptTemplateForChat } from "../../chat-core/prompt-templates-repository";

import type {
  PromptTemplateResolvedWorldInfo,
  PromptTemplateResolvedWorldInfoActivationEntry,
} from "../../chat-core/prompt-template-context";
import type { PromptBuildOutput } from "../contracts";
import type { OperationTrigger } from "@shared/types/operation-profiles";

const DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant.";

export type PromptWorldInfoDiagnostics = {
  worldInfoBefore: string;
  worldInfoAfter: string;
  depthEntries: PromptTemplateResolvedWorldInfo["depthEntries"];
  outletEntries: PromptTemplateResolvedWorldInfo["outletEntries"];
  anTop: string[];
  anBottom: string[];
  emTop: string[];
  emBottom: string[];
  warnings: string[];
  activatedCount: number;
  activatedEntries: PromptTemplateResolvedWorldInfoActivationEntry[];
};

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
}): Promise<{
  prompt: PromptBuildOutput;
  templateContext: Awaited<ReturnType<typeof buildPromptTemplateRenderContext>>;
  worldInfoDiagnostics: PromptWorldInfoDiagnostics;
}> {
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
    worldInfoDiagnostics: {
      worldInfoBefore: resolvedWorldInfo.worldInfoBefore,
      worldInfoAfter: resolvedWorldInfo.worldInfoAfter,
      depthEntries: resolvedWorldInfo.depthEntries,
      outletEntries: resolvedWorldInfo.outletEntries,
      anTop: resolvedWorldInfo.anTop,
      anBottom: resolvedWorldInfo.anBottom,
      emTop: resolvedWorldInfo.emTop,
      emBottom: resolvedWorldInfo.emBottom,
      warnings: [...resolvedWorldInfo.warnings],
      activatedCount: resolvedWorldInfo.activatedCount,
      activatedEntries: [...resolvedWorldInfo.activatedEntries],
    },
  };
}
