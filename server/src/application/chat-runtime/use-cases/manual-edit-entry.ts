import { HttpError } from "@core/middleware/error-handler";
import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { withDbTransaction } from "../../../db/client";
import { getChatById } from "../../../services/chat-core/chats-repository";
import {
  buildInstructionRenderContext,
  resolveAndApplyWorldInfoToTemplateContext,
} from "../../../services/chat-core/prompt-template-context";
import { getBranchCurrentTurn } from "../../../services/chat-entry-parts/branch-turn-repository";
import {
  getActiveVariantWithParts,
  getEntryById,
  updateEntryMeta,
} from "../../../services/chat-entry-parts/entries-repository";
import { applyManualEditToPart } from "../../../services/chat-entry-parts/parts-repository";
import {
  isRecord,
  renderUserInputWithLiquid,
  resolveManualEditTargetPart,
} from "../chat-entry-helpers";

export type ManualEditEntryInput = {
  entryId: string;
  body: {
    ownerId?: string;
    partId?: string;
    content: string;
    requestId?: string;
  };
};

export type ManualEditEntryResult = {
  entryId: string;
  activeVariantId: string;
};

export async function manualEditEntry(
  params: ManualEditEntryInput
): Promise<ManualEditEntryResult> {
  const entry = await getEntryById({ entryId: params.entryId });
  if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");

  const activeVariant = await getActiveVariantWithParts({ entry });
  if (!activeVariant) {
    throw new HttpError(400, "Active variant не найден", "VALIDATION_ERROR");
  }

  const currentTurn = await getBranchCurrentTurn({ branchId: entry.branchId });
  const targetPart = resolveManualEditTargetPart({
    entry,
    activeVariant,
    currentTurn,
    requestedPartId: params.body.partId,
  });

  const ownerId = resolveTrustedOwnerId(params.body.ownerId);
  const chat = await getChatById(entry.chatId);
  const templateContext = await buildInstructionRenderContext({
    ownerId,
    chatId: entry.chatId,
    branchId: entry.branchId,
    entityProfileId: chat?.entityProfileId ?? undefined,
    historyLimit: 50,
  });
  await resolveAndApplyWorldInfoToTemplateContext({
    context: templateContext,
    ownerId,
    chatId: entry.chatId,
    branchId: entry.branchId,
    entityProfileId: chat?.entityProfileId ?? undefined,
    trigger: "generate",
    dryRun: true,
  });
  const { renderedContent, changed } = await renderUserInputWithLiquid({
    content: params.body.content,
    context: templateContext,
    options: { allowEmptyResult: true },
  });

  const nextMeta = {
    ...(isRecord(entry.meta) ? entry.meta : {}),
    templateRender: {
      engine: "liquidjs" as const,
      rawContent: params.body.content,
      renderedContent,
      changed,
      renderedAt: new Date().toISOString(),
      source: "manual_edit" as const,
    },
  };

  await withDbTransaction((tx) => {
    applyManualEditToPart({
      partId: targetPart.partId,
      payloadText: renderedContent,
      payloadFormat: targetPart.payloadFormat,
      requestId: params.body.requestId,
      executor: tx,
    });
    updateEntryMeta({
      entryId: entry.entryId,
      meta: nextMeta,
      executor: tx,
    });
  });

  return {
    entryId: entry.entryId,
    activeVariantId: activeVariant.variantId,
  };
}
