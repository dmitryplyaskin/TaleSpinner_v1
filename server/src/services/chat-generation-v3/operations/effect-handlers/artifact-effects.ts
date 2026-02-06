import type { OperationProfile } from "@shared/types/operation-profiles";

import { ProfileSessionArtifactStore } from "../../artifacts/profile-session-artifact-store";
import { RunArtifactStore } from "../../artifacts/run-artifact-store";
import type { ArtifactValue } from "../../contracts";

export async function applyArtifactEffect(params: {
  ownerId: string;
  chatId: string;
  branchId: string;
  sessionKey: string | null;
  profile: OperationProfile | null;
  runStore: RunArtifactStore;
  effect: {
    tag: string;
    persistence: "persisted" | "run_only";
    usage: string;
    semantics: string;
    value: string;
  };
}): Promise<ArtifactValue> {
  if (params.effect.persistence === "run_only") {
    return params.runStore.upsert({
      tag: params.effect.tag,
      usage: params.effect.usage as any,
      semantics: params.effect.semantics as any,
      value: params.effect.value,
    });
  }

  if (!params.sessionKey) {
    throw new Error("Persisted artifact write requested without session key");
  }

  const persisted = await ProfileSessionArtifactStore.upsert({
    ownerId: params.ownerId,
    sessionKey: params.sessionKey,
    chatId: params.chatId,
    branchId: params.branchId,
    profile: params.profile,
    tag: params.effect.tag,
    usage: params.effect.usage as any,
    semantics: params.effect.semantics as any,
    value: params.effect.value,
  });
  return persisted;
}
