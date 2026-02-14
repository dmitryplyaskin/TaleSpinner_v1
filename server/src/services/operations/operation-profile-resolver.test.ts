import { describe, expect, test, vi } from "vitest";

import { resolveCompiledOperationProfile } from "./operation-profile-resolver";

import type { OperationBlock, OperationProfile } from "@shared/types/operation-profiles";

const blockById = new Map<string, OperationBlock>();

vi.mock("./operation-blocks-repository", () => ({
  getOperationBlockById: vi.fn(async (id: string) => blockById.get(id) ?? null),
}));

function makeBlock(params: {
  blockId: string;
  version: number;
  order: number;
}): OperationBlock {
  const now = new Date();
  return {
    blockId: params.blockId,
    ownerId: "global",
    name: params.blockId,
    enabled: true,
    version: params.version,
    operations: [
      {
        opId: "op-1e6df0d9-2d3a-420f-83f0-a4e90ca1b056",
        name: "op",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["before_main_llm"],
          order: params.order,
          dependsOn: [],
          params: {
            template: "hello",
            output: {
              type: "artifacts",
              writeArtifact: {
                tag: `${params.blockId.replace(/-/g, "_")}_state`,
                persistence: "run_only",
                usage: "internal",
                semantics: "intermediate",
              },
            },
          },
        },
      },
    ],
    meta: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("operation profile resolver", () => {
  test("flattens block operations by block order and namespaces op ids", async () => {
    blockById.clear();
    blockById.set("11111111-1111-4111-8111-111111111111", makeBlock({
      blockId: "11111111-1111-4111-8111-111111111111",
      version: 2,
      order: 5,
    }));
    blockById.set("22222222-2222-4222-8222-222222222222", makeBlock({
      blockId: "22222222-2222-4222-8222-222222222222",
      version: 3,
      order: 1,
    }));

    const now = new Date();
    const profile: OperationProfile = {
      profileId: "profile-1",
      ownerId: "global",
      name: "profile",
      enabled: true,
      executionMode: "sequential",
      operationProfileSessionId: "sess-1",
      version: 1,
      blockRefs: [
        {
          blockId: "11111111-1111-4111-8111-111111111111",
          enabled: true,
          order: 20,
        },
        {
          blockId: "22222222-2222-4222-8222-222222222222",
          enabled: true,
          order: 10,
        },
      ],
      meta: null,
      createdAt: now,
      updatedAt: now,
    };

    const out = await resolveCompiledOperationProfile(profile);
    expect(out.operations).toHaveLength(2);
    expect(out.operations[0]?.opId.startsWith("22222222-2222-4222-8222-222222222222:")).toBe(true);
    expect(out.operations[1]?.opId.startsWith("11111111-1111-4111-8111-111111111111:")).toBe(true);
    expect(out.blockVersionFingerprint).toBe(
      "22222222-2222-4222-8222-222222222222:3|11111111-1111-4111-8111-111111111111:2"
    );
  });

  test("keeps legacy operations when profile has no block refs", async () => {
    const now = new Date();
    const profile: OperationProfile = {
      profileId: "legacy",
      ownerId: "global",
      name: "legacy",
      enabled: true,
      executionMode: "sequential",
      operationProfileSessionId: "sess-legacy",
      version: 1,
      blockRefs: [],
      operations: [],
      meta: null,
      createdAt: now,
      updatedAt: now,
    };
    const out = await resolveCompiledOperationProfile(profile);
    expect(out.blockVersionFingerprint).toBe("");
    expect(out.operations).toEqual([]);
  });
});
