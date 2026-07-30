import { HttpError } from "@core/middleware/error-handler";
import { resolveTrustedOwnerId } from "@core/request-context/owner-scope-storage";

import { withDbTransaction } from "../../../db/client";
import { getChatById } from "../../../services/chat-core/chats-repository";
import { getBranchCurrentTurn, incrementBranchTurn } from "../../../services/chat-entry-parts/branch-turn-repository";
import {
  createEntryWithVariant,
  getActiveVariantWithParts,
  listEntries,
} from "../../../services/chat-entry-parts/entries-repository";
import { createPart } from "../../../services/chat-entry-parts/parts-repository";
import { resolveContinueUserTurnTarget } from "../chat-entry-helpers";
import {
  createAssistantReasoningPart,
  finalizeChatGenerationArtifacts,
} from "../chat-generation-helpers";
import { buildChatGenerationSession } from "../generation-session";

import type { ChatGenerationSession } from "../contracts";

export type ContinueGenerationInput = {
  chatId: string;
  body: {
    ownerId?: string;
    branchId?: string;
    settings: Record<string, unknown>;
    requestId?: string;
  };
  abortController?: AbortController;
};

export async function continueGeneration(
  params: ContinueGenerationInput
): Promise<ChatGenerationSession> {
  const chat = await getChatById(params.chatId);
  if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

  const ownerId = resolveTrustedOwnerId(params.body.ownerId);
  const branchId = params.body.branchId || chat.activeBranchId;
  if (!branchId) {
    throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
  }

  const lastEntries = await listEntries({
    chatId: params.chatId,
    branchId,
    limit: 1,
  });
  const lastEntry = lastEntries.length > 0 ? lastEntries[lastEntries.length - 1] : null;
  const lastVariant = lastEntry ? await getActiveVariantWithParts({ entry: lastEntry }) : null;
  const currentTurn = await getBranchCurrentTurn({ branchId });
  const userTurnTarget = resolveContinueUserTurnTarget({
    lastEntry,
    lastVariant,
    currentTurn,
  });

  const staged = await withDbTransaction((tx) => {
    const newTurn = incrementBranchTurn({ branchId, executor: tx });
    const assistant = createEntryWithVariant({
      ownerId,
      chatId: params.chatId,
      branchId,
      role: "assistant",
      variantKind: "generation",
      executor: tx,
    });
    const assistantMainPart = createPart({
      ownerId,
      variantId: assistant.variant.variantId,
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
      requestId: params.body.requestId,
      executor: tx,
    });
    const assistantReasoningPart = createAssistantReasoningPart({
      ownerId,
      variantId: assistant.variant.variantId,
      createdTurn: newTurn,
      requestId: params.body.requestId,
      executor: tx,
    });

    return {
      assistantEntryId: assistant.entry.entryId,
      assistantVariantId: assistant.variant.variantId,
      assistantMainPartId: assistantMainPart.partId,
      assistantReasoningPartId: assistantReasoningPart.partId,
    };
  });

  return buildChatGenerationSession({
    envBase: {
      chatId: params.chatId,
      branchId,
      userEntryId: userTurnTarget.userEntryId,
      userMainPartId: userTurnTarget.userMainPartId,
      assistantEntryId: staged.assistantEntryId,
      assistantVariantId: staged.assistantVariantId,
      assistantMainPartId: staged.assistantMainPartId,
      assistantReasoningPartId: staged.assistantReasoningPartId,
    },
    request: {
      ownerId,
      chatId: params.chatId,
      branchId,
      entityProfileId: chat.entityProfileId,
      trigger: "generate",
      source: "continue",
      settings: params.body.settings,
      abortController: params.abortController,
      persistenceTarget: {
        mode: "entry_parts",
        assistantEntryId: staged.assistantEntryId,
        assistantMainPartId: staged.assistantMainPartId,
        assistantReasoningPartId: staged.assistantReasoningPartId,
      },
      userTurnTarget: {
        mode: "entry_parts",
        userEntryId: userTurnTarget.userEntryId,
        userMainPartId: userTurnTarget.userMainPartId,
      },
    },
    afterRun: async ({ generationId }) => {
      await finalizeChatGenerationArtifacts({
        generationId,
        assistantVariantId: staged.assistantVariantId,
        cleanupEmptyEntryId: staged.assistantEntryId,
      });
    },
  });
}
