import { describe, expect, test } from "vitest";

import type { OperationProfileUpsertInput } from "@shared/types/operation-profiles";

import { validateOperationProfileUpsertInput } from "./operation-profile-validator";

function makeBaseInput(): OperationProfileUpsertInput {
  return {
    name: "profile",
    enabled: true,
    executionMode: "sequential" as const,
    operationProfileSessionId: "2d9f1f5c-6f38-4f94-9caa-0ea4f36f2db8",
    operations: [] as OperationProfileUpsertInput["operations"],
  };
}

describe("operation profile validator hardening", () => {
  test("rejects prompt_time when before_main_llm hook is absent", () => {
    const input = makeBaseInput();
    input.operations = [
      {
        opId: "3bb9de69-77f9-4298-b44e-c6a831c44df3",
        name: "invalid",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["after_main_llm"],
          order: 10,
          params: {
            template: "hello",
            output: {
              type: "prompt_time",
              promptTime: { kind: "system_update", mode: "prepend", source: "t" },
            },
          },
        },
      },
    ] as any;

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(
      /prompt_time output requires before_main_llm hook/
    );
  });

  test("rejects assistant canonicalization without after_main_llm hook", () => {
    const input = makeBaseInput();
    input.operations = [
      {
        opId: "10e3f9db-c484-4e70-9ea2-6d7827d8b1f4",
        name: "invalid",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["before_main_llm"],
          order: 10,
          params: {
            template: "hello",
            output: {
              type: "turn_canonicalization",
              canonicalization: { kind: "replace_text", target: "assistant" },
            },
          },
        },
      },
    ] as any;

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(
      /target=assistant requires after_main_llm hook/
    );
  });

  test("rejects cross-hook dependencies", () => {
    const input = makeBaseInput();
    input.operations = [
      {
        opId: "d530608e-b393-4f99-9d22-9f46f13331fc",
        name: "dep",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["before_main_llm"],
          order: 10,
          params: {
            template: "dep",
            output: {
              type: "artifacts",
              writeArtifact: {
                tag: "dep_tag",
                persistence: "run_only",
                usage: "internal",
                semantics: "intermediate",
              },
            },
          },
        },
      },
      {
        opId: "b8404607-5bb2-4f6f-badf-723713ff7974",
        name: "op",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["after_main_llm"],
          order: 20,
          dependsOn: ["d530608e-b393-4f99-9d22-9f46f13331fc"],
          params: {
            template: "op",
            output: {
              type: "artifacts",
              writeArtifact: {
                tag: "op_tag",
                persistence: "run_only",
                usage: "internal",
                semantics: "intermediate",
              },
            },
          },
        },
      },
    ] as any;

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(
      /Cross-hook dependsOn is not allowed/
    );
  });

  test("rejects invalid liquid template syntax", () => {
    const input = makeBaseInput();
    input.operations = [
      {
        opId: "93f03a8f-838b-47f0-a885-a8dc7f9ff76a",
        name: "invalid",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["before_main_llm"],
          order: 10,
          params: {
            template: "{{ bad ",
            output: {
              type: "artifacts",
              writeArtifact: {
                tag: "tag_x",
                persistence: "run_only",
                usage: "internal",
                semantics: "intermediate",
              },
            },
          },
        },
      },
    ] as any;

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/Template не компилируется/);
  });
});
