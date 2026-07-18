import {
  normalizeOperationArtifactConfig,
  type LegacyOperationOutput,
  type OperationBlock,
  type OperationProfile,
} from "@shared/types/operation-profiles";
import { describe, expect, test, vi } from "vitest";

import { resolveCompiledOperationProfile } from "./operation-profile-resolver";


const blockById = new Map<string, OperationBlock>();

vi.mock("./operation-blocks-repository", () => ({
  getOperationBlockById: vi.fn(
    async (params: { ownerId: string; blockId: string }) =>
      blockById.get(params.blockId) ?? null
  ),
}));

function makeBlock(params: {
  blockId: string;
  version: number;
  order: number;
  artifactTag?: string;
  withGuardConsumer?: boolean;
}): OperationBlock {
  const now = new Date();
  return {
    blockId: params.blockId,
    ownerId: "global",
    name: params.blockId,
    enabled: true,
    version: params.version,
    operations: params.withGuardConsumer
      ? [
          {
            opId: "11111111-1111-4111-8111-111111111111",
            name: "guard",
            kind: "guard",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              order: params.order,
              dependsOn: [],
              params: {
                engine: "liquid",
                outputContract: [{ key: "isBattle", title: "Battle" }],
                template: "{\"isBattle\": true}",
                artifact: normalizeOperationArtifactConfig({
                  opId: "11111111-1111-4111-8111-111111111111",
                  kind: "guard",
                  title: "guard",
                  rawParams: {
                    artifact: {
                      artifactId: "artifact:11111111-1111-4111-8111-111111111111",
                      tag: `block_${params.blockId.replace(/-/g, "_")}_guard`,
                      title: "Guard state",
                      format: "json",
                      persistence: "run_only",
                      writeMode: "replace",
                      history: {
                        enabled: true,
                        maxItems: 20,
                      },
                      exposures: [],
                    },
                  },
                }),
              },
            },
          },
          {
            opId: "22222222-2222-4222-8222-222222222222",
            name: "consumer",
            kind: "template",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              order: params.order + 1,
              dependsOn: ["11111111-1111-4111-8111-111111111111"],
              runConditions: [
                {
                  type: "guard_output",
                  sourceOpId: "11111111-1111-4111-8111-111111111111",
                  outputKey: "isBattle",
                  operator: "is_true",
                },
              ],
              params: {
                template: "hello",
                artifact: normalizeOperationArtifactConfig({
                  opId: "22222222-2222-4222-8222-222222222222",
                  kind: "template",
                  title: "consumer",
                  rawParams: {
                    output: {
                      type: "artifacts",
                      writeArtifact: {
                        tag: params.artifactTag ?? `block_${params.blockId.replace(/-/g, "_")}_state`,
                        persistence: "run_only",
                        usage: "internal",
                        semantics: "intermediate",
                      },
                    } satisfies LegacyOperationOutput,
                  },
                }),
              },
            },
          },
        ]
      : [
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
                artifact: normalizeOperationArtifactConfig({
                  opId: "op-1e6df0d9-2d3a-420f-83f0-a4e90ca1b056",
                  kind: "template",
                  title: "op",
                  rawParams: {
                    output: {
                      type: "artifacts",
                      writeArtifact: {
                        tag: params.artifactTag ?? `block_${params.blockId.replace(/-/g, "_")}_state`,
                        persistence: "run_only",
                        usage: "internal",
                        semantics: "intermediate",
                      },
                    } satisfies LegacyOperationOutput,
                  },
                }),
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

  test("rejects duplicate artifact writers after block flattening", async () => {
    blockById.clear();
    blockById.set("11111111-1111-4111-8111-111111111111", makeBlock({
      blockId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      order: 10,
      artifactTag: "shared_state",
    }));
    blockById.set("22222222-2222-4222-8222-222222222222", makeBlock({
      blockId: "22222222-2222-4222-8222-222222222222",
      version: 1,
      order: 20,
      artifactTag: "shared_state",
    }));

    const now = new Date();
    const profile: OperationProfile = {
      profileId: "profile-dup",
      ownerId: "global",
      name: "dup",
      enabled: true,
      executionMode: "sequential",
      operationProfileSessionId: "sess-dup",
      version: 1,
      blockRefs: [
        { blockId: "11111111-1111-4111-8111-111111111111", enabled: true, order: 10 },
        { blockId: "22222222-2222-4222-8222-222222222222", enabled: true, order: 20 },
      ],
      meta: null,
      createdAt: now,
      updatedAt: now,
    };

    await expect(resolveCompiledOperationProfile(profile)).rejects.toThrow(
      /duplicate artifact (tag|id) in compiled profile/i
    );
  });

  test("prefixes guard run condition source ids when flattening block operations", async () => {
    blockById.clear();
    blockById.set("11111111-1111-4111-8111-111111111111", makeBlock({
      blockId: "11111111-1111-4111-8111-111111111111",
      version: 1,
      order: 10,
      withGuardConsumer: true,
    }));

    const now = new Date();
    const profile: OperationProfile = {
      profileId: "profile-guard",
      ownerId: "global",
      name: "guard",
      enabled: true,
      executionMode: "sequential",
      operationProfileSessionId: "sess-guard",
      version: 1,
      blockRefs: [
        { blockId: "11111111-1111-4111-8111-111111111111", enabled: true, order: 10 },
      ],
      meta: null,
      createdAt: now,
      updatedAt: now,
    };

    const out = await resolveCompiledOperationProfile(profile);
    const consumer = out.operations.find((item) => item.kind === "template" && item.name === "consumer");
    expect(consumer?.config.runConditions).toEqual([
      {
        type: "guard_output",
        sourceOpId: "11111111-1111-4111-8111-111111111111:11111111-1111-4111-8111-111111111111",
        outputKey: "isBattle",
        operator: "is_true",
      },
    ]);
  });
});
