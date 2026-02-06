import { resolveGatewayModel } from "../../llm/llm-gateway-adapter";
import { getProviderConfig, getRuntime } from "../../llm/llm-repository";
import { createGeneration } from "../../chat-core/generations-repository";
import { getOperationProfileSettings } from "../../operations/operation-profile-settings-repository";
import { getOperationProfileById } from "../../operations/operation-profiles-repository";
import { stripChatGenerationDebugSettings } from "../debug";

import type { OperationProfile } from "@shared/types/operation-profiles";

import type { ProfileSnapshot, RunContext, RunRequest } from "../contracts";

function buildSessionKey(params: {
  ownerId: string;
  chatId: string;
  branchId: string;
  profile: OperationProfile;
}): string {
  return [
    params.ownerId,
    params.chatId,
    params.branchId,
    params.profile.profileId,
    String(params.profile.version),
    params.profile.operationProfileSessionId,
  ].join(":");
}

function toProfileSnapshot(profile: OperationProfile): ProfileSnapshot {
  return {
    profileId: profile.profileId,
    version: profile.version,
    executionMode: profile.executionMode,
    operationProfileSessionId: profile.operationProfileSessionId,
    operations: profile.operations,
  };
}

export async function resolveRunContext(params: {
  request: RunRequest;
}): Promise<{
  context: RunContext;
  profile: OperationProfile | null;
}> {
  const ownerId = params.request.ownerId ?? "global";
  const runtime = await getRuntime("global", ownerId);
  const providerConfig = await getProviderConfig(runtime.activeProviderId);
  const model = resolveGatewayModel({
    providerId: runtime.activeProviderId,
    runtimeModel: runtime.activeModel,
    providerConfig: providerConfig.config,
  });

  const settings = await getOperationProfileSettings();
  const activeProfile = settings.activeProfileId
    ? await getOperationProfileById(settings.activeProfileId)
    : null;
  const profile = activeProfile && activeProfile.enabled ? activeProfile : null;

  const generation = await createGeneration({
    ownerId,
    chatId: params.request.chatId,
    branchId: params.request.branchId,
    messageId: params.request.persistenceTarget.assistantMessageId,
    variantId: params.request.persistenceTarget.variantId,
    providerId: runtime.activeProviderId,
    model,
    settings: stripChatGenerationDebugSettings(params.request.settings),
  });

  const startedAt = Date.now();
  const sessionKey = profile
    ? buildSessionKey({
        ownerId,
        chatId: params.request.chatId,
        branchId: params.request.branchId,
        profile,
      })
    : null;

  const context: RunContext = {
    ownerId,
    runId: generation.id,
    generationId: generation.id,
    trigger: params.request.trigger,
    chatId: params.request.chatId,
    branchId: params.request.branchId,
    entityProfileId: params.request.entityProfileId,
    profileSnapshot: profile ? toProfileSnapshot(profile) : null,
    runtimeInfo: {
      providerId: runtime.activeProviderId,
      model,
    },
    sessionKey,
    historyLimit: params.request.historyLimit ?? 50,
    startedAt,
  };

  return { context, profile };
}
