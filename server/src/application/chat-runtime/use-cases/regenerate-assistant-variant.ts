import { HttpError } from "@core/middleware/error-handler";
import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { withDbTransaction } from "../../../db/client";
import { getChatById } from "../../../services/chat-core/chats-repository";
import {
  getBranchCurrentTurn,
  incrementBranchTurn,
} from "../../../services/chat-entry-parts/branch-turn-repository";
import { getEntryById } from "../../../services/chat-entry-parts/entries-repository";
import { createPart } from "../../../services/chat-entry-parts/parts-repository";
import { selectActiveVariant } from "../../../services/chat-entry-parts/variants-repository";
import {
  createAssistantReasoningPart,
  createDetachedGenerationVariant,
  finalizeChatGenerationArtifacts,
  resolveRegenerateUserTurnTarget,
} from "../chat-generation-helpers";
import { buildChatGenerationSession } from "../generation-session";

import type { ChatGenerationSession } from "../contracts";

export type RegenerateAssistantVariantInput = {
  entryId: string;
  body: {
    ownerId?: string;
    settings: Record<string, unknown>;
    requestId?: string;
  };
  abortController?: AbortController;
};

export async function regenerateAssistantVariant(
  params: RegenerateAssistantVariantInput
): Promise<ChatGenerationSession> {
  const entry = await getEntryById({ entryId: params.entryId });
  if (!entry) throw new HttpError(404, "Entry не найден", "NOT_FOUND");
  if (entry.role !== "assistant") {
    throw new HttpError(400, "regenerate поддерживается только для role=assistant", "VALIDATION_ERROR");
  }

  const chat = await getChatById(entry.chatId);
  if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

  const ownerId = resolveTrustedOwnerId(params.body.ownerId);
  const currentTurn = await getBranchCurrentTurn({ branchId: entry.branchId });
  const userTurnTarget = await resolveRegenerateUserTurnTarget({
    chatId: entry.chatId,
    branchId: entry.branchId,
    assistantEntry: entry,
    currentTurn,
  });

  const staged = await withDbTransaction((tx) => {
    const newTurn = incrementBranchTurn({ branchId: entry.branchId, executor: tx });
    const newVariant = createDetachedGenerationVariant({
      ownerId,
      entryId: entry.entryId,
      executor: tx,
    });
    selectActiveVariant({
      entryId: entry.entryId,
      variantId: newVariant.variantId,
      executor: tx,
    });

    const assistantMainPart = createPart({
      ownerId,
      variantId: newVariant.variantId,
      channel: "main",
      order: 0,
      payload: "",
      payloadFormat: "markdown",
      visibility: { ui: "always", prompt: true },
      ui: { rendererId: "markdown" },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: newTurn,
      source: "llm",
      executor: tx,
    });
    const assistantReasoningPart = createAssistantReasoningPart({
      ownerId,
      variantId: newVariant.variantId,
      createdTurn: newTurn,
      requestId: params.body.requestId,
      executor: tx,
    });

    return {
      assistantVariantId: newVariant.variantId,
      assistantMainPartId: assistantMainPart.partId,
      assistantReasoningPartId: assistantReasoningPart.partId,
    };
  });

  return buildChatGenerationSession({
    envBase: {
      chatId: entry.chatId,
      branchId: entry.branchId,
      ...(userTurnTarget
        ? {
            userEntryId: userTurnTarget.userEntryId,
            userMainPartId: userTurnTarget.userMainPartId,
          }
        : {}),
      assistantEntryId: entry.entryId,
      assistantVariantId: staged.assistantVariantId,
      assistantMainPartId: staged.assistantMainPartId,
      assistantReasoningPartId: staged.assistantReasoningPartId,
    },
    request: {
      ownerId,
      chatId: entry.chatId,
      branchId: entry.branchId,
      entityProfileId: chat.entityProfileId,
      trigger: "regenerate",
      source: "regenerate",
      settings: params.body.settings,
      abortController: params.abortController,
      persistenceTarget: {
        mode: "entry_parts",
        assistantEntryId: entry.entryId,
        assistantMainPartId: staged.assistantMainPartId,
        assistantReasoningPartId: staged.assistantReasoningPartId,
      },
      userTurnTarget,
    },
    afterRun: async ({ generationId }) => {
      await finalizeChatGenerationArtifacts({
        generationId,
        assistantVariantId: staged.assistantVariantId,
        cleanupEntryId: entry.entryId,
      });
    },
  });
}
