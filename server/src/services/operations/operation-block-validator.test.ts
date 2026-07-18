import { buildOperationArtifactId } from "@shared/types/operation-profiles";
import { describe, expect, test } from "vitest";


import { validateOperationBlockUpsertInput } from "./operation-block-validator";

describe("operation block validator", () => {
  test("rejects blocks with more than 64 operations", () => {
    const operations = Array.from({ length: 65 }, (_, index) => ({
      opId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      name: `operation-${index}`,
      kind: "template" as const,
      config: {
        enabled: true,
        required: false,
        hooks: ["before_main_llm" as const],
        order: index,
        params: { template: "ok" },
      },
    }));

    expect(() =>
      validateOperationBlockUpsertInput({
        name: "oversized",
        enabled: true,
        operations,
      })
    ).toThrow(/Validation error/);
  });

  test("rejects oversized templates and artifact histories", () => {
    const base = {
      name: "block",
      enabled: true,
      operations: [
        {
          opId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
          name: "template-op",
          kind: "template" as const,
          config: {
            enabled: true,
            required: false,
            hooks: ["before_main_llm" as const],
            order: 10,
            params: {
              template: "x".repeat(100_001),
            },
          },
        },
      ],
    };
    expect(() => validateOperationBlockUpsertInput(base)).toThrow(/Validation error/);

    const withLargeHistory = structuredClone(base);
    withLargeHistory.operations[0]!.config.params.template = "ok";
    Object.assign(withLargeHistory.operations[0]!.config.params, {
      artifact: {
        artifactId: "artifact:test",
        tag: "test",
        title: "Test",
        format: "text",
        persistence: "run_only",
        writeMode: "replace",
        history: { enabled: true, maxItems: 101 },
        exposures: [],
      },
    });
    expect(() => validateOperationBlockUpsertInput(withLargeHistory)).toThrow(
      /Validation error/
    );
  });

  test("rejects legacy operation kind", () => {
    expect(() =>
      validateOperationBlockUpsertInput({
        name: "block",
        enabled: true,
        operations: [
          {
            opId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
            name: "legacy-op",
            kind: "legacy",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              order: 10,
              params: {
                params: {},
              },
            },
          },
        ],
      })
    ).toThrow(/Validation error/);
  });

  test("accepts valid block", () => {
    const out = validateOperationBlockUpsertInput({
      name: "block",
      enabled: true,
      operations: [
        {
          opId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
          name: "template-op",
          kind: "template",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              activation: {
                everyNTurns: 5,
              },
              order: 10,
              params: {
                template: "Hello",
              output: {
                type: "artifacts",
                writeArtifact: {
                  tag: "world_state",
                  persistence: "run_only",
                  usage: "internal",
                  semantics: "intermediate",
                },
              },
            },
          },
        },
      ],
    });
    expect(out.operations).toHaveLength(1);
    expect(out.operations[0]?.config.params.artifact.artifactId).toBe(buildOperationArtifactId("6ff77029-5037-4d21-8ace-c9836f58a14b"));
    expect(out.operations[0]?.config.params.artifact.tag).toBe("world_state");
  });

  test("preserves the selected LLM preset id", () => {
    const out = validateOperationBlockUpsertInput({
      name: "block",
      enabled: true,
      operations: [
        {
          opId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
          name: "llm-op",
          kind: "llm",
          config: {
            enabled: true,
            required: false,
            hooks: ["before_main_llm"],
            order: 10,
            params: {
              params: {
                providerId: "openrouter",
                credentialRef: "credential-1",
                model: "model-1",
                llmPresetId: "preset-1",
                prompt: "Hello",
              },
            },
          },
        },
      ],
    });

    const operation = out.operations[0];
    expect(operation?.kind).toBe("llm");
    if (operation?.kind !== "llm") throw new Error("Expected LLM operation");
    expect(operation.config.params.params.llmPresetId).toBe("preset-1");
  });

  test("rejects dependency to unknown opId", () => {
    expect(() =>
      validateOperationBlockUpsertInput({
        name: "block",
        enabled: true,
        operations: [
          {
            opId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
            name: "template-op",
            kind: "template",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              order: 10,
              dependsOn: ["365f9038-f2d8-4f64-a30f-0fdd5a91bf73"],
              params: {
                template: "Hello",
                output: {
                  type: "artifacts",
                  writeArtifact: {
                    tag: "world_state",
                    persistence: "run_only",
                    usage: "internal",
                    semantics: "intermediate",
                  },
                },
              },
            },
          },
        ],
      })
    ).toThrow(/unknown opId/);
  });

  test("rejects empty activation object", () => {
    const payload = {
      name: "block",
      enabled: true,
      operations: [
        {
          opId: "6ff77029-5037-4d21-8ace-c9836f58a14b",
          name: "template-op",
          kind: "template" as const,
          config: {
            enabled: true,
            required: false,
            hooks: ["before_main_llm" as const],
            activation: {},
            order: 10,
            params: {
              template: "Hello",
              output: {
                type: "artifacts" as const,
                writeArtifact: {
                  tag: "world_state",
                  persistence: "run_only" as const,
                  usage: "internal" as const,
                  semantics: "intermediate",
                },
              },
            },
          },
        },
      ],
    };

    expect(() => validateOperationBlockUpsertInput(payload)).toThrow(/Validation error/);

    try {
      validateOperationBlockUpsertInput(payload);
      expect.unreachable("expected validation error");
    } catch (error) {
      const issues = (error as { details?: { issues?: Array<{ message?: string }> } }).details?.issues ?? [];
      expect(issues.some((issue) => issue.message === "activation must include at least one interval")).toBe(true);
    }
  });

  test("fills missing tag for artifact configs loaded from older saved blocks", () => {
    const out = validateOperationBlockUpsertInput({
      name: "block",
      enabled: true,
      operations: [
        {
          opId: "9ff77029-5037-4d21-8ace-c9836f58a14b",
          name: "saved-op",
          kind: "template",
          config: {
            enabled: true,
            required: false,
            hooks: ["before_main_llm"],
            order: 10,
            params: {
              template: "Hello",
              artifact: {
                artifactId: "artifact:9ff77029-5037-4d21-8ace-c9836f58a14b",
                title: "Saved artifact",
                format: "markdown",
                persistence: "run_only",
                writeMode: "replace",
                history: {
                  enabled: true,
                  maxItems: 20,
                },
                exposures: [],
              },
            },
          },
        },
      ],
    });

    expect(out.operations[0]?.config.params.artifact.tag).toBe("saved_op");
  });

  test("migrates legacy prompt_time output into artifact exposures", () => {
    const out = validateOperationBlockUpsertInput({
      name: "block",
      enabled: true,
      operations: [
        {
          opId: "7ff77029-5037-4d21-8ace-c9836f58a14b",
          name: "prompt-op",
          kind: "template",
          config: {
            enabled: true,
            required: false,
            hooks: ["before_main_llm"],
            order: 10,
            params: {
              template: "Hello",
              output: {
                type: "prompt_time",
                promptTime: {
                  kind: "append_after_last_user",
                  role: "system",
                  source: "legacy",
                },
              },
            },
          },
        },
      ],
    });

    expect(out.operations[0]?.config.params.artifact.exposures).toEqual([
      {
        type: "prompt_message",
        role: "system",
        anchor: "after_last_user",
        source: "legacy",
      },
    ]);
  });

  test("rejects prompt_message exposure in after_main_llm hook", () => {
    expect(() =>
      validateOperationBlockUpsertInput({
        name: "block",
        enabled: true,
        operations: [
          {
            opId: "8ff77029-5037-4d21-8ace-c9836f58a14b",
            name: "bad-op",
            kind: "template",
            config: {
              enabled: true,
              required: false,
              hooks: ["after_main_llm"],
              order: 10,
              params: {
                template: "Hello",
                artifact: {
                  artifactId: "artifact:bad-op",
                  tag: "bad_artifact",
                  title: "Bad artifact",
                  format: "markdown",
                  persistence: "run_only",
                  writeMode: "replace",
                  history: {
                    enabled: true,
                    maxItems: 20,
                  },
                  exposures: [
                    {
                      type: "prompt_message",
                      role: "system",
                      anchor: "after_last_user",
                    },
                  ],
                },
              },
            },
          },
        ],
      })
    ).toThrow(/before_main_llm/i);
  });

  test("accepts valid guard with run condition consumer", () => {
    const out = validateOperationBlockUpsertInput({
      name: "block",
      enabled: true,
      operations: [
        {
          opId: "11111111-1111-4111-8111-111111111111",
          name: "combat-guard",
          kind: "guard",
          config: {
            enabled: true,
            required: false,
            hooks: ["before_main_llm"],
            order: 10,
            params: {
              engine: "liquid",
              outputContract: [
                { key: "isBattle", title: "Battle" },
                { key: "isNight", title: "Night" },
              ],
              template: "{\"isBattle\": true, \"isNight\": false}",
              artifact: {
                artifactId: "artifact:11111111-1111-4111-8111-111111111111",
                tag: "combat_guard_state",
                title: "Combat guard state",
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
          },
        },
        {
          opId: "22222222-2222-4222-8222-222222222222",
          name: "combat-consumer",
          kind: "template",
          config: {
            enabled: true,
            required: false,
            hooks: ["before_main_llm"],
            order: 20,
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
              template: "combat",
              artifact: {
                artifactId: "artifact:22222222-2222-4222-8222-222222222222",
                tag: "combat_text",
                title: "Combat text",
                format: "markdown",
                persistence: "run_only",
                writeMode: "replace",
                history: {
                  enabled: true,
                  maxItems: 20,
                },
                exposures: [],
              },
            },
          },
        },
      ],
    });

    expect(out.operations[0]?.kind).toBe("guard");
    expect(out.operations[1]?.config.runConditions).toEqual([
      {
        type: "guard_output",
        sourceOpId: "11111111-1111-4111-8111-111111111111",
        outputKey: "isBattle",
        operator: "is_true",
      },
    ]);
  });

  test("rejects guard with non-json artifact format", () => {
    expect(() =>
      validateOperationBlockUpsertInput({
        name: "block",
        enabled: true,
        operations: [
          {
            opId: "11111111-1111-4111-8111-111111111111",
            name: "combat-guard",
            kind: "guard",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              order: 10,
              params: {
                engine: "liquid",
                outputContract: [{ key: "isBattle", title: "Battle" }],
                template: "{\"isBattle\": true}",
                artifact: {
                  artifactId: "artifact:11111111-1111-4111-8111-111111111111",
                  tag: "combat_guard_state",
                  title: "Combat guard state",
                  format: "markdown",
                  persistence: "run_only",
                  writeMode: "replace",
                  history: {
                    enabled: true,
                    maxItems: 20,
                  },
                  exposures: [],
                },
              },
            },
          },
        ],
      })
    ).toThrow(/guard artifact format/i);
  });

  test("rejects run condition with unknown output key", () => {
    expect(() =>
      validateOperationBlockUpsertInput({
        name: "block",
        enabled: true,
        operations: [
          {
            opId: "11111111-1111-4111-8111-111111111111",
            name: "combat-guard",
            kind: "guard",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              order: 10,
              params: {
                engine: "liquid",
                outputContract: [{ key: "isBattle", title: "Battle" }],
                template: "{\"isBattle\": true}",
                artifact: {
                  artifactId: "artifact:11111111-1111-4111-8111-111111111111",
                  tag: "combat_guard_state",
                  title: "Combat guard state",
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
              order: 20,
              dependsOn: ["11111111-1111-4111-8111-111111111111"],
              runConditions: [
                {
                  type: "guard_output",
                  sourceOpId: "11111111-1111-4111-8111-111111111111",
                  outputKey: "missingFlag",
                  operator: "is_true",
                },
              ],
              params: {
                template: "Hello",
                artifact: {
                  artifactId: "artifact:22222222-2222-4222-8222-222222222222",
                  tag: "consumer_state",
                  title: "Consumer state",
                  format: "markdown",
                  persistence: "run_only",
                  writeMode: "replace",
                  history: {
                    enabled: true,
                    maxItems: 20,
                  },
                  exposures: [],
                },
              },
            },
          },
        ],
      })
    ).toThrow(/runCondition references unknown guard output/i);
  });

  test("rejects run condition without matching dependsOn", () => {
    expect(() =>
      validateOperationBlockUpsertInput({
        name: "block",
        enabled: true,
        operations: [
          {
            opId: "11111111-1111-4111-8111-111111111111",
            name: "combat-guard",
            kind: "guard",
            config: {
              enabled: true,
              required: false,
              hooks: ["before_main_llm"],
              order: 10,
              params: {
                engine: "liquid",
                outputContract: [{ key: "isBattle", title: "Battle" }],
                template: "{\"isBattle\": true}",
                artifact: {
                  artifactId: "artifact:11111111-1111-4111-8111-111111111111",
                  tag: "combat_guard_state",
                  title: "Combat guard state",
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
              order: 20,
              runConditions: [
                {
                  type: "guard_output",
                  sourceOpId: "11111111-1111-4111-8111-111111111111",
                  outputKey: "isBattle",
                  operator: "is_true",
                },
              ],
              params: {
                template: "Hello",
                artifact: {
                  artifactId: "artifact:22222222-2222-4222-8222-222222222222",
                  tag: "consumer_state",
                  title: "Consumer state",
                  format: "markdown",
                  persistence: "run_only",
                  writeMode: "replace",
                  history: {
                    enabled: true,
                    maxItems: 20,
                  },
                  exposures: [],
                },
              },
            },
          },
        ],
      })
    ).toThrow(/runCondition sourceOpId must also appear in dependsOn/i);
  });
});

