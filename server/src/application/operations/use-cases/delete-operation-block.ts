import { HttpError } from "@core/middleware/error-handler";

import {
  deleteOperationBlock,
  getOperationBlockById,
} from "../../../services/operations/operation-blocks-repository";
import { listOperationProfiles } from "../../../services/operations/operation-profiles-repository";

export async function deleteOperationBlockWithValidation(params: {
  ownerId: string;
  blockId: string;
}): Promise<{ id: string }> {
  const exists = await getOperationBlockById({
    ownerId: params.ownerId,
    blockId: params.blockId,
  });
  if (!exists) throw new HttpError(404, "OperationBlock не найден", "NOT_FOUND");

  const profiles = await listOperationProfiles({ ownerId: params.ownerId });
  const linked = profiles.find((profile) =>
    profile.blockRefs.some((ref) => ref.blockId === params.blockId)
  );
  if (linked) {
    throw new HttpError(400, "OperationBlock is used by profile", "VALIDATION_ERROR", {
      blockId: params.blockId,
      profileId: linked.profileId,
    });
  }

  await deleteOperationBlock({ ownerId: params.ownerId, blockId: params.blockId });
  return { id: params.blockId };
}
