import { HttpError } from "@core/middleware/error-handler";

import { withDbTransaction } from "../../../db/client";
import { getChatById } from "../../../services/chat-core/chats-repository";
import {
  buildInstructionRenderContext,
  resolveAndApplyWorldInfoToTemplateContext,
} from "../../../services/chat-core/prompt-template-context";
import { getSelectedUserPerson } from "../../../services/chat-core/user-persons-repository";
import { getBranchCurrentTurn, incrementBranchTurn } from "../../../services/chat-entry-parts/branch-turn-repository";
import { createEntryWithVariant } from "../../../services/chat-entry-parts/entries-repository";
import { createPart } from "../../../services/chat-entry-parts/parts-repository";
import { buildUserEntryMeta, renderUserInputWithLiquid } from "../chat-entry-helpers";
import {
  createAssistantReasoningPart,
  finalizeChatGenerationArtifacts,
} from "../chat-generation-helpers";
import { buildChatGenerationSession } from "../generation-session";

import type { ChatGenerationSession } from "../contracts";

export type CreateEntryAndStartGenerationInput = {
  chatId: string;
  body: {
    ownerId?: string;
    branchId?: string;
    role: "user" | "system";
    content: string;
    settings: Record<string, unknown>;
    requestId?: string;
  };
  abortController?: AbortController;
};

export async function createEntryAndStartGeneration(
  params: CreateEntryAndStartGenerationInput
): Promise<ChatGenerationSession> {
  const chat = await getChatById(params.chatId);
  if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

  const ownerId = params.body.ownerId ?? "global";
  const branchId = params.body.branchId || chat.activeBranchId;
  if (!branchId) {
    throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
  }

  const templateContext = await buildInstructionRenderContext({
    ownerId,
    chatId: params.chatId,
    branchId,
    entityProfileId: chat.entityProfileId,
    historyLimit: 50,
  });
  await resolveAndApplyWorldInfoToTemplateContext({
    context: templateContext,
    ownerId,
    chatId: params.chatId,
    branchId,
    entityProfileId: chat.entityProfileId,
    trigger: "generate",
    dryRun: true,
  });
  const { renderedContent, changed } = await renderUserInputWithLiquid({
    content: params.body.content ?? "",
    context: templateContext,
  });

  const selectedUser = await getSelectedUserPerson({ ownerId });
  const staged = await withDbTransaction((tx) => {
    const currentTurn = getBranchCurrentTurn({ branchId, executor: tx });
    const userEntryMeta = buildUserEntryMeta({
      requestId: params.body.requestId,
      selectedUser,
      templateRender: {
        engine: "liquidjs",
        rawContent: params.body.content ?? "",
        renderedContent,
        changed,
        renderedAt: new Date().toISOString(),
        source: "entry_create",
      },
    });

    const user = createEntryWithVariant({
      ownerId,
      chatId: params.chatId,
      branchId,
      role: params.body.role,
      variantKind: "manual_edit",
      meta: userEntryMeta,
      executor: tx,
    });

    const userMainPart = createPart({
      ownerId,
      variantId: user.variant.variantId,
      channel: "main",
      order: 0,
      payload: renderedContent,
      payloadFormat: "markdown",
      visibility: { ui: "always", prompt: true },
      ui: { rendererId: "markdown" },
      prompt: { serializerId: "asText" },
      lifespan: "infinite",
      createdTurn: currentTurn,
      source: "user",
      requestId: params.body.requestId,
      executor: tx,
    });

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
      userEntryId: user.entry.entryId,
      userMainPartId: userMainPart.partId,
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
      userEntryId: staged.userEntryId,
      userMainPartId: staged.userMainPartId,
      userRenderedContent: renderedContent,
      assistantEntryId: staged.assistantEntryId,
      assistantVariantId: staged.assistantVariantId,
      assistantMainPartId: staged.assistantMainPartId,
      assistantReasoningPartId: staged.assistantReasoningPartId,
    },
    request: {
      requestId: params.body.requestId,
      ownerId,
      chatId: params.chatId,
      branchId,
      entityProfileId: chat.entityProfileId,
      trigger: "generate",
      source: params.body.role === "user" ? "user_message" : "system_message",
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
        userEntryId: staged.userEntryId,
        userMainPartId: staged.userMainPartId,
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
