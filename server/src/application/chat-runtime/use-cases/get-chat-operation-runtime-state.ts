import { HttpError } from "@core/middleware/error-handler";

import { getChatById } from "../../../services/chat-core/chats-repository";
import { normalizeOperationActivationConfig } from "../../../services/chat-generation-v3/operations/operation-activation-intervals";
import { loadOrBootstrapRuntimeState } from "../../../services/chat-generation-v3/runtime/operation-runtime-state";
import { resolveCompiledOperationProfile } from "../../../services/operations/operation-profile-resolver";
import { getOperationProfileSettings } from "../../../services/operations/operation-profile-settings-repository";
import { getOperationProfileById } from "../../../services/operations/operation-profiles-repository";

import type { ChatOperationRuntimeStateDto } from "@shared/types/chat-runtime-state";

export type GetChatOperationRuntimeStateInput = {
  chatId: string;
  branchId?: string;
};

function isActivationReached(params: {
  everyNTurns?: number;
  everyNContextTokens?: number;
  turnsCounter: number;
  tokensCounter: number;
}): boolean {
  const turnsReached =
    typeof params.everyNTurns === "number" && params.turnsCounter >= params.everyNTurns;
  const tokensReached =
    typeof params.everyNContextTokens === "number" &&
    params.tokensCounter >= params.everyNContextTokens;
  return turnsReached || tokensReached;
}

function buildEmptyState(chatId: string, branchId: string): ChatOperationRuntimeStateDto {
  return {
    chatId,
    branchId,
    profileId: null,
    operationProfileSessionId: null,
    updatedAt: null,
    operations: [],
  };
}

export async function getChatOperationRuntimeState(
  params: GetChatOperationRuntimeStateInput
): Promise<ChatOperationRuntimeStateDto> {
  const chat = await getChatById(params.chatId);
  if (!chat) throw new HttpError(404, "Chat не найден", "NOT_FOUND");

  const branchId = params.branchId ?? chat.activeBranchId;
  if (!branchId) {
    throw new HttpError(400, "branchId обязателен (нет activeBranchId)", "VALIDATION_ERROR");
  }

  const empty = buildEmptyState(chat.id, branchId);

  const settings = await getOperationProfileSettings({ ownerId: chat.ownerId });
  if (!settings.activeProfileId) return empty;

  const profile = await getOperationProfileById({
    ownerId: chat.ownerId,
    profileId: settings.activeProfileId,
  });
  if (!profile || !profile.enabled) return empty;

  const compiled = await resolveCompiledOperationProfile(profile);
  const runtime = await loadOrBootstrapRuntimeState({
    scope: {
      ownerId: chat.ownerId,
      chatId: chat.id,
      branchId,
      profileId: profile.profileId,
      operationProfileSessionId: profile.operationProfileSessionId,
    },
    operations: compiled.operations,
    source: "system_message",
  });

  return {
    chatId: chat.id,
    branchId,
    profileId: profile.profileId,
    operationProfileSessionId: profile.operationProfileSessionId,
    updatedAt: runtime.updatedAt.toISOString(),
    operations: compiled.operations.map((operation) => {
      const normalized = normalizeOperationActivationConfig(operation.config.activation);
      const state = runtime.payload.activationByOpId[operation.opId] ?? {
        turnsCounter: 0,
        tokensCounter: 0,
      };

      return {
        opId: operation.opId,
        everyNTurns: normalized?.everyNTurns,
        everyNContextTokens: normalized?.everyNContextTokens,
        turnsCounter: state.turnsCounter,
        tokensCounter: state.tokensCounter,
        isReachedNow: isActivationReached({
          everyNTurns: normalized?.everyNTurns,
          everyNContextTokens: normalized?.everyNContextTokens,
          turnsCounter: state.turnsCounter,
          tokensCounter: state.tokensCounter,
        }),
      };
    }),
  };
}
