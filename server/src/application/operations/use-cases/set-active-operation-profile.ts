import { HttpError } from "@core/middleware/error-handler";

import { resolveCompiledOperationProfile } from "../../../services/operations/operation-profile-resolver";
import { setActiveOperationProfile } from "../../../services/operations/operation-profile-settings-repository";
import { getOperationProfileById } from "../../../services/operations/operation-profiles-repository";

export async function setActiveOperationProfileWithValidation(
  params: { ownerId: string; activeProfileId: string | null }
) {
  if (params.activeProfileId !== null) {
    const profile = await getOperationProfileById({
      ownerId: params.ownerId,
      profileId: params.activeProfileId,
    });
    if (!profile) {
      throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");
    }
    await resolveCompiledOperationProfile(profile);
  }

  return setActiveOperationProfile(params);
}
