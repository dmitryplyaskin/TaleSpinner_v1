import { getChatById } from "./chats-repository";
import {
  type PipelineProfileScope,
  getPipelineProfileBinding,
} from "./pipeline-profile-bindings-repository";
import { getPipelineProfileById, type PipelineProfileDto } from "./pipeline-profiles-repository";

export type ActiveProfileSource = PipelineProfileScope | "none";

export type ResolvedActivePipelineProfile = {
  profile: PipelineProfileDto | null;
  source: ActiveProfileSource;
  profileId: string | null;
  profileVersion: number | null;
};

export async function resolveActivePipelineProfile(params: {
  ownerId?: string;
  chatId: string;
  entityProfileId: string;
}): Promise<ResolvedActivePipelineProfile> {
  const ownerId = params.ownerId ?? "global";

  const chatBinding = await getPipelineProfileBinding({
    ownerId,
    scope: "chat",
    scopeId: params.chatId,
  });
  if (chatBinding) {
    const profile = await getPipelineProfileById(chatBinding.profileId);
    return {
      profile,
      source: "chat",
      profileId: profile?.id ?? chatBinding.profileId,
      profileVersion: profile?.version ?? null,
    };
  }

  const entityBinding = await getPipelineProfileBinding({
    ownerId,
    scope: "entity_profile",
    scopeId: params.entityProfileId,
  });
  if (entityBinding) {
    const profile = await getPipelineProfileById(entityBinding.profileId);
    return {
      profile,
      source: "entity_profile",
      profileId: profile?.id ?? entityBinding.profileId,
      profileVersion: profile?.version ?? null,
    };
  }

  const globalBinding = await getPipelineProfileBinding({
    ownerId,
    scope: "global",
  });
  if (globalBinding) {
    const profile = await getPipelineProfileById(globalBinding.profileId);
    return {
      profile,
      source: "global",
      profileId: profile?.id ?? globalBinding.profileId,
      profileVersion: profile?.version ?? null,
    };
  }

  return { profile: null, source: "none", profileId: null, profileVersion: null };
}

export async function resolveActivePipelineProfileForChat(params: {
  ownerId?: string;
  chatId: string;
}): Promise<ResolvedActivePipelineProfile & { entityProfileId: string | null }> {
  const chat = await getChatById(params.chatId);
  if (!chat) return { profile: null, source: "none", profileId: null, profileVersion: null, entityProfileId: null };
  const resolved = await resolveActivePipelineProfile({
    ownerId: params.ownerId,
    chatId: params.chatId,
    entityProfileId: chat.entityProfileId,
  });
  return { ...resolved, entityProfileId: chat.entityProfileId };
}

