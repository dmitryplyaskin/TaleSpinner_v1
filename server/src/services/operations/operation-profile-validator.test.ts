import { describe, expect, test } from "vitest";

import {
  validateOperationProfileImport,
  validateOperationProfileUpsertInput,
} from "./operation-profile-validator";

describe("operation profile validator", () => {
  test("accepts profile with unique block refs", () => {
    const out = validateOperationProfileUpsertInput({
      name: "profile",
      enabled: true,
      executionMode: "sequential",
      operationProfileSessionId: "2d9f1f5c-6f38-4f94-9caa-0ea4f36f2db8",
      blockRefs: [
        {
          blockId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
          enabled: true,
          order: 10,
        },
      ],
    });
    expect(out.blockRefs).toHaveLength(1);
  });

  test("rejects duplicate block refs", () => {
    expect(() =>
      validateOperationProfileUpsertInput({
        name: "profile",
        enabled: true,
        executionMode: "sequential",
        operationProfileSessionId: "2d9f1f5c-6f38-4f94-9caa-0ea4f36f2db8",
        blockRefs: [
          {
            blockId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
            enabled: true,
            order: 10,
          },
          {
            blockId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
            enabled: true,
            order: 20,
          },
        ],
      })
    ).toThrow(/Duplicate blockId/);
  });

  test("parses v2 bundle import", () => {
    const out = validateOperationProfileImport({
      type: "operation_profile_bundle",
      version: 2,
      profile: {
        name: "profile",
        enabled: true,
        executionMode: "sequential",
        operationProfileSessionId: "2d9f1f5c-6f38-4f94-9caa-0ea4f36f2db8",
        blockRefs: [],
      },
      blocks: [],
    });
    expect(out.kind).toBe("bundle_v2");
  });

  test("parses legacy v1 import", () => {
    const out = validateOperationProfileImport({
      name: "legacy",
      enabled: true,
      executionMode: "sequential",
      operationProfileSessionId: "2d9f1f5c-6f38-4f94-9caa-0ea4f36f2db8",
      operations: [],
    });
    expect(out.kind).toBe("legacy_v1");
  });
});
