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

function makeArtifactsOutput() {
  return {
    type: "artifacts" as const,
    writeArtifact: {
      tag: "llm_output",
      persistence: "run_only" as const,
      usage: "internal" as const,
      semantics: "intermediate",
    },
  };
}

function makeLlmOperation(
  overrides?: Partial<
    Extract<OperationProfileUpsertInput["operations"][number], { kind: "llm" }>
  >
): Extract<OperationProfileUpsertInput["operations"][number], { kind: "llm" }> {
  return {
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
          credentialRef: "token-1",
          model: "openai/gpt-4.1-mini",
          system: "You are assistant",
          prompt: "Hello {{user_input}}",
          strictVariables: false,
          outputMode: "text",
          samplerPresetId: "preset-1",
          samplers: { temperature: 0.2, topP: 1, maxTokens: 400 },
          timeoutMs: 10_000,
          retry: { maxAttempts: 2, backoffMs: 100, retryOn: ["provider_error"] },
        },
        output: makeArtifactsOutput(),
      },
      triggers: ["generate", "regenerate"],
      dependsOn: [],
    },
    ...overrides,
  };
}

function makeExampleJsonSchemaSpec() {
  return {
    project_name: "string: Название проекта",
    budget: "number: Бюджет в долларах",
    "is_active?": "boolean: Активен ли проект",
    team: {
      leader: "string: Имя тимлида",
      members_count: 10,
    },
    tasks: [
      {
        id: "number: ID задачи",
        title: "string: Заголовок задачи",
        "tags?": ["string: тег"],
      },
    ],
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

  test("normalizes legacy prompt_time role developer to system", () => {
    const input = makeBaseInput();
    input.operations = [
      {
        opId: "db3fc30f-27c9-4005-af10-0442e00fbe6c",
        name: "legacy-role",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["before_main_llm"],
          order: 10,
          params: {
            template: "hello",
            output: {
              type: "prompt_time",
              promptTime: { kind: "append_after_last_user", role: "developer", source: "legacy" },
            },
          },
        },
      },
    ] as any;

    const out = validateOperationProfileUpsertInput(input);
    const output = (out.operations[0] as any)?.config?.params?.output;
    expect(output).toMatchObject({
      type: "prompt_time",
      promptTime: {
        kind: "append_after_last_user",
        role: "system",
      },
    });
  });

  test("normalizes prompt_time insert_at_depth to positive integer depth", () => {
    const input = makeBaseInput();
    input.operations = [
      {
        opId: "cfcd1a36-ee7b-4a48-99f2-32abae39f6f0",
        name: "legacy-depth",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["before_main_llm"],
          order: 10,
          params: {
            template: "hello",
            output: {
              type: "prompt_time",
              promptTime: { kind: "insert_at_depth", depthFromEnd: -4.9, role: "assistant" },
            },
          },
        },
      },
    ] as any;

    const out = validateOperationProfileUpsertInput(input);
    const output = (out.operations[0] as any)?.config?.params?.output;
    expect(output).toMatchObject({
      type: "prompt_time",
      promptTime: {
        kind: "insert_at_depth",
        depthFromEnd: 5,
        role: "assistant",
      },
    });
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

  test("accepts valid llm operation config", () => {
    const input = makeBaseInput();
    input.operations = [makeLlmOperation()];

    const validated = validateOperationProfileUpsertInput(input);
    expect(validated.operations).toHaveLength(1);
    expect(validated.operations[0]?.kind).toBe("llm");
  });

  test("rejects llm config with invalid provider", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              providerId: "bad_provider" as any,
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/Validation error/);
  });

  test("rejects llm config with empty credentialRef", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              credentialRef: "",
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/Validation error/);
  });

  test("rejects llm config with invalid retry / outputMode", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "xml" as any,
              retry: { maxAttempts: 0 },
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/Validation error/);
  });

  test("rejects llm prompt template that does not compile", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              prompt: "{{ bad ",
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/LLM prompt template не компилируется/);
  });

  test("rejects llm system template that does not compile", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              system: "{{ bad ",
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/LLM system template не компилируется/);
  });

  test("accepts llm strict JSON schema config", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "json",
              strictSchemaValidation: true,
              jsonSchema: makeExampleJsonSchemaSpec(),
            },
          },
        },
      }),
    ];

    const out = validateOperationProfileUpsertInput(input);
    expect(out.operations[0]?.kind).toBe("llm");
  });

  test("rejects llm strict schema validation without json output mode", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "text",
              strictSchemaValidation: true,
              jsonSchema: makeExampleJsonSchemaSpec(),
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(
      /strictSchemaValidation requires outputMode=json/
    );
  });

  test("rejects llm strict schema validation without schema", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "json",
              strictSchemaValidation: true,
              jsonSchema: undefined,
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(
      /strictSchemaValidation requires jsonSchema/
    );
  });

  test("rejects invalid llm json schema descriptor", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "json",
              strictSchemaValidation: true,
              jsonSchema: {
                title: "str: unsupported type",
              },
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/LLM jsonSchema не валидна/);
  });

  test("accepts llm json parse mode markdown_code_block", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "json",
              jsonParseMode: "markdown_code_block",
            },
          },
        },
      }),
    ];

    const out = validateOperationProfileUpsertInput(input);
    expect(out.operations[0]?.kind).toBe("llm");
  });

  test("rejects jsonParseMode when outputMode is not json", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "text",
              jsonParseMode: "markdown_code_block",
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/Validation error/);
  });

  test("rejects custom_regex parse mode without pattern", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "json",
              jsonParseMode: "custom_regex",
              jsonCustomPattern: undefined,
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/Validation error/);
  });

  test("rejects custom_regex parse mode with invalid flags", () => {
    const input = makeBaseInput();
    input.operations = [
      makeLlmOperation({
        config: {
          ...makeLlmOperation().config,
          params: {
            ...makeLlmOperation().config.params,
            params: {
              ...makeLlmOperation().config.params.params,
              outputMode: "json",
              jsonParseMode: "custom_regex",
              jsonCustomPattern: "<result>([\\s\\S]*?)</result>",
              jsonCustomFlags: "x",
            },
          },
        },
      }),
    ];

    expect(() => validateOperationProfileUpsertInput(input)).toThrow(/Validation error/);
  });
});
