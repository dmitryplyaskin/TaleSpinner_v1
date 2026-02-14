import { HttpError } from "@core/middleware/error-handler";
import { getOperationBlockById } from "./operation-blocks-repository";

import type {
  OperationBlock,
  OperationInProfile,
  OperationProfile,
} from "@shared/types/operation-profiles";

const ORDER_BUCKET = 1_000_000;

export type CompiledOperationProfile = {
  profile: OperationProfile;
  operations: OperationInProfile[];
  blockVersions: Array<{ blockId: string; version: number }>;
  blockVersionFingerprint: string;
};

function normalizeOrder(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.trunc(value);
}

function mapOperationToRuntime(params: {
  blockId: string;
  blockOrderIndex: number;
  op: OperationInProfile;
}): OperationInProfile {
  const blockPrefix = `${params.blockId}:`;
  const opId = `${blockPrefix}${params.op.opId}`;
  const dependsOn = params.op.config.dependsOn?.map((dep) => `${blockPrefix}${dep}`);
  const order = params.blockOrderIndex * ORDER_BUCKET + normalizeOrder(params.op.config.order);
  return {
    ...params.op,
    opId,
    config: {
      ...params.op.config,
      order,
      dependsOn: dependsOn?.length ? dependsOn : undefined,
    },
  } as OperationInProfile;
}

async function resolveBlocks(
  profile: OperationProfile
): Promise<Array<{ refOrder: number; block: OperationBlock }>> {
  const rawRefs = Array.isArray(profile.blockRefs) ? profile.blockRefs : [];
  const enabledRefs = rawRefs
    .filter((ref) => ref.enabled)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.blockId.localeCompare(b.blockId);
    });
  const out: Array<{ refOrder: number; block: OperationBlock }> = [];
  for (const ref of enabledRefs) {
    const block = await getOperationBlockById(ref.blockId);
    if (!block) {
      throw new HttpError(400, "Operation block not found", "VALIDATION_ERROR", {
        blockId: ref.blockId,
        profileId: profile.profileId,
      });
    }
    if (!block.enabled) continue;
    out.push({ refOrder: ref.order, block });
  }
  return out;
}

export async function resolveCompiledOperationProfile(
  profile: OperationProfile
): Promise<CompiledOperationProfile> {
  if (!Array.isArray(profile.blockRefs) || profile.blockRefs.length === 0) {
    const operations = profile.operations ?? [];
    return {
      profile,
      operations,
      blockVersions: [],
      blockVersionFingerprint: operations.length > 0 ? "legacy_ops" : "",
    };
  }

  const resolvedBlocks = await resolveBlocks(profile);
  const operations: OperationInProfile[] = [];
  const blockVersions: Array<{ blockId: string; version: number }> = [];

  resolvedBlocks.forEach((item, blockIndex) => {
    blockVersions.push({ blockId: item.block.blockId, version: item.block.version });
    for (const op of item.block.operations) {
      operations.push(
        mapOperationToRuntime({
          blockId: item.block.blockId,
          blockOrderIndex: blockIndex,
          op,
        })
      );
    }
  });

  const blockVersionFingerprint = blockVersions
    .map((item) => `${item.blockId}:${item.version}`)
    .join("|");

  return {
    profile,
    operations,
    blockVersions,
    blockVersionFingerprint,
  };
}
