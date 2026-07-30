import { HttpError } from "@core/middleware/error-handler";

import { getOperationBlockById } from "../../../services/operations/operation-blocks-repository";
import { getOperationProfileById } from "../../../services/operations/operation-profiles-repository";

export async function exportOperationProfileBundle(params: {
  ownerId: string;
  profileId: string;
}): Promise<{
  type: "operation_profile_bundle";
  version: 2;
  profile: {
    profileId: string;
    name: string;
    description: string | null;
    enabled: boolean;
    executionMode: "concurrent" | "sequential";
    operationProfileSessionId: string;
    blockRefs: Array<{
      blockId: string;
      enabled: boolean;
      order: number;
    }>;
    meta?: unknown;
  };
  blocks: Array<{
    blockId: string;
    name: string;
    description: string | null;
    enabled: boolean;
    operations: unknown[];
    meta?: unknown;
  }>;
}> {
  const item = await getOperationProfileById(params);
  if (!item) throw new HttpError(404, "OperationProfile не найден", "NOT_FOUND");

  const blocks = [];
  for (const ref of item.blockRefs) {
    const block = await getOperationBlockById({
      ownerId: params.ownerId,
      blockId: ref.blockId,
    });
    if (!block) {
      throw new HttpError(400, "OperationBlock не найден", "VALIDATION_ERROR", {
        profileId: item.profileId,
        blockId: ref.blockId,
      });
    }
    blocks.push({
      blockId: block.blockId,
      name: block.name,
      description: block.description ?? null,
      enabled: block.enabled,
      operations: block.operations,
      meta: block.meta ?? undefined,
    });
  }

  return {
    type: "operation_profile_bundle",
    version: 2,
    profile: {
      profileId: item.profileId,
      name: item.name,
      description: item.description ?? null,
      enabled: item.enabled,
      executionMode: item.executionMode,
      operationProfileSessionId: item.operationProfileSessionId,
      blockRefs: item.blockRefs,
      meta: item.meta ?? undefined,
    },
    blocks,
  };
}
