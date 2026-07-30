import {
  normalizeOperationArtifactConfig,
  type LegacyOperationOutput,
  type OperationInProfile,
} from "@shared/types/operation-profiles";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { executeOperationsPhase } from "./execute-operations-phase";

import type { InstructionRenderContext } from "../../chat-core/prompt-template-renderer";


const mocks = vi.hoisted(() => ({
  llmGatewayStream: vi.fn(),
  getProviderConfig: vi.fn(),
  getTokenPlaintext: vi.fn(),
  buildGatewayStreamRequest: vi.fn(),
}));

vi.mock("@core/llm-gateway", () => ({
  llmGateway: {
    stream: mocks.llmGatewayStream,
  },
}));

vi.mock("../../llm/llm-repository", () => ({
  getProviderConfig: mocks.getProviderConfig,
  getTokenPlaintext: mocks.getTokenPlaintext,
}));

vi.mock("../../llm/llm-gateway-adapter", () => ({
  buildGatewayStreamRequest: mocks.buildGatewayStreamRequest,
}));

type TemplateOp = Extract<OperationInProfile, { kind: "template" }>;
type LlmOp = Extract<OperationInProfile, { kind: "llm" }>;
type GuardOp = Extract<OperationInProfile, { kind: "guard" }>;

function toArtifact(params: {
  opId: string;
  kind: "template" | "llm" | "compute";
  title: string;
  output: LegacyOperationOutput;
  llmOutputMode?: "text" | "json";
}) {
  return normalizeOperationArtifactConfig({
    opId: params.opId,
    kind: params.kind,
    title: params.title,
    rawParams: {
      output: params.output,
      ...(params.llmOutputMode ? { params: { outputMode: params.llmOutputMode } } : {}),
    },
  });
}

function streamOf(
  events: Array<
    | { type: "delta"; text: string }
    | { type: "reasoning_delta"; text: string }
    | { type: "error"; message: string }
    | { type: "done"; status: "done" | "aborted" | "error"; warnings?: string[] }
  >
): AsyncGenerator<any> {
  return (async function* () {
    for (const event of events) {
      yield event;
    }
  })();
}

function makeTemplateContext(): InstructionRenderContext {
  return {
    char: {},
    user: { name: "User" },
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  };
}

function makeLlmOp(params: {
  opId: string;
  order: number;
  prompt: string;
  output: LegacyOperationOutput;
  hooks?: LlmOp["config"]["hooks"];
  dependsOn?: string[];
  outputMode?: "text" | "json";
  jsonParseMode?: "raw" | "markdown_code_block" | "custom_regex";
  jsonCustomPattern?: string;
  jsonCustomFlags?: string;
  strictSchemaValidation?: boolean;
  jsonSchema?: unknown;
  timeoutMs?: number;
  retry?: { maxAttempts: number; backoffMs?: number; retryOn?: Array<"timeout" | "provider_error" | "rate_limit"> };
}): LlmOp {
  return {
    opId: params.opId,
    name: params.opId,
    kind: "llm",
    config: {
      enabled: true,
      required: false,
      hooks: params.hooks ?? ["before_main_llm"],
      triggers: ["generate", "regenerate"],
      order: params.order,
      dependsOn: params.dependsOn,
      params: {
        params: {
          providerId: "openrouter",
          credentialRef: "token-1",
          prompt: params.prompt,
          outputMode: params.outputMode,
          jsonParseMode: params.jsonParseMode,
          jsonCustomPattern: params.jsonCustomPattern,
          jsonCustomFlags: params.jsonCustomFlags,
          strictSchemaValidation: params.strictSchemaValidation,
          jsonSchema: params.jsonSchema,
          timeoutMs: params.timeoutMs,
          retry: params.retry,
        },
        artifact: toArtifact({
          opId: params.opId,
          kind: "llm",
          title: params.opId,
          output: params.output,
          llmOutputMode: params.outputMode,
        }),
      },
    },
  };
}

function artifactOutput(tag: string): LegacyOperationOutput {
  return {
    type: "artifacts",
    writeArtifact: {
      tag,
      persistence: "run_only",
      usage: "internal",
      semantics: "intermediate",
    },
  };
}

function makeTemplateOp(params: {
  opId: string;
  order: number;
  template: string;
  output: LegacyOperationOutput;
  hooks?: TemplateOp["config"]["hooks"];
  dependsOn?: string[];
  required?: boolean;
  enabled?: boolean;
  strictVariables?: boolean;
}): TemplateOp {
  return {
    opId: params.opId,
    name: params.opId,
    kind: "template",
    config: {
      enabled: params.enabled ?? true,
      required: params.required ?? false,
      hooks: params.hooks ?? ["before_main_llm"],
      triggers: ["generate", "regenerate"],
      order: params.order,
      dependsOn: params.dependsOn,
      params: {
        template: params.template,
        strictVariables: params.strictVariables,
        artifact: toArtifact({
          opId: params.opId,
          kind: "template",
          title: params.opId,
          output: params.output,
        }),
      },
    },
  };
}

function makeComputeOp(params: {
  opId: string;
  order: number;
  hooks?: Array<"before_main_llm" | "after_main_llm">;
}): OperationInProfile {
  return {
    opId: params.opId,
    name: params.opId,
    kind: "compute",
    config: {
      enabled: true,
      required: false,
      hooks: params.hooks ?? ["before_main_llm"],
      triggers: ["generate", "regenerate"],
      order: params.order,
      params: {
        params: { noop: true } as Record<string, unknown>,
        artifact: toArtifact({
          opId: params.opId,
          kind: "compute",
          title: params.opId,
          output: artifactOutput(`compute_${params.opId}`),
        }),
      },
    },
  };
}

function makeGuardOp(params: {
  opId: string;
  order: number;
  engine: "liquid" | "aux_llm";
  outputContract: Array<{ key: string; title: string }>;
  template?: string;
  system?: string;
  prompt?: string;
  dependsOn?: string[];
}): GuardOp {
  const artifact = normalizeOperationArtifactConfig({
    opId: params.opId,
    kind: "guard",
    title: params.opId,
    rawParams: {
      artifact: {
        artifactId: `artifact:${params.opId}`,
        tag: `${params.opId.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_state`,
        title: `${params.opId} state`,
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
  });
  const guardParams =
    params.engine === "liquid"
      ? {
          engine: "liquid" as const,
          outputContract: params.outputContract,
          template: params.template ?? "{\"matched\": true}",
          artifact,
        }
      : {
          engine: "aux_llm" as const,
          outputContract: params.outputContract,
          providerId: "openrouter" as const,
          credentialRef: "token-1",
          system: params.system,
          prompt: params.prompt ?? "Return guard JSON",
          artifact,
        };

  return {
    opId: params.opId,
    name: params.opId,
    kind: "guard",
    config: {
      enabled: true,
      required: false,
      hooks: ["before_main_llm"],
      triggers: ["generate", "regenerate"],
      order: params.order,
      dependsOn: params.dependsOn,
      params: guardParams,
    },
  };
}

function makeBaseMessages() {
  return [
    { role: "system" as const, content: "sys" },
    { role: "user" as const, content: "hello" },
  ];
}

function makeBaseArtifacts() {
  return {};
}

function collectEvents<T>() {
  const items: T[] = [];
  return {
    items,
    push: (value: T) => {
      items.push(value);
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProviderConfig.mockResolvedValue({
    providerId: "openrouter",
    config: {},
  });
  mocks.getTokenPlaintext.mockResolvedValue("secret");
  mocks.buildGatewayStreamRequest.mockImplementation((params: any) => ({
    provider: { id: params.providerId, token: params.token },
    model: "m",
    messages: params.messages,
    sampling: {},
    extra: {},
    abortSignal: params.abortSignal,
  }));
  mocks.llmGatewayStream.mockImplementation(() =>
    streamOf([
      { type: "delta", text: "ok" },
      { type: "done", status: "done" },
    ])
  );
});

describe("executeOperationsPhase", () => {
  test("caps concurrent operation execution at four tasks", async () => {
    let active = 0;
    let maxActive = 0;
    mocks.llmGatewayStream.mockImplementation(() =>
      (async function* () {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 10));
        yield { type: "delta", text: "ok" };
        active -= 1;
        yield { type: "done", status: "done" };
      })()
    );

    const operations = Array.from({ length: 10 }, (_, index) =>
      makeLlmOp({
        opId: `llm-${index}`,
        order: index,
        prompt: "bounded",
        output: artifactOutput(`result_${index}`),
      })
    );

    const out = await executeOperationsPhase({
      runId: "bounded-concurrency",
      hook: "before_main_llm",
      trigger: "generate",
      operations,
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out.every((item) => item.status === "done")).toBe(true);
    expect(maxActive).toBe(4);
  });

  test("rejects auxiliary LLM output larger than 256 KiB", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "x".repeat(256 * 1024 + 1) },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "bounded-output",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-large-output",
          order: 1,
          prompt: "bounded",
          output: artifactOutput("large_output"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]).toMatchObject({
      status: "error",
      error: { code: "LLM_OUTPUT_TOO_LARGE" },
    });
  });

  test("rejects oversized template output before effects are created", async () => {
    const out = await executeOperationsPhase({
      runId: "bounded-template-output",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "large-template-output",
          order: 1,
          template: "x".repeat(256 * 1024 + 1),
          output: artifactOutput("large_template"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]).toMatchObject({
      status: "error",
      error: { code: "ARTIFACT_VALUE_TOO_LARGE" },
    });
  });

  test("returns activation skip with skip details", async () => {
    const out = await executeOperationsPhase({
      runId: "run-eligible-filter",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "eligible-op",
          order: 10,
          template: "eligible",
          output: artifactOutput("eligible_tag"),
        }),
        makeTemplateOp({
          opId: "ineligible-op",
          order: 20,
          template: "ineligible",
          output: artifactOutput("ineligible_tag"),
        }),
      ],
      activationSkippedByOpId: new Map([
        [
          "ineligible-op",
          {
            everyNTurns: 5,
            turnsCounter: 3,
            tokensCounter: 1200,
          },
        ],
      ]),
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out).toHaveLength(2);
    const byId = new Map(out.map((item) => [item.opId, item] as const));
    expect(byId.get("eligible-op")?.status).toBe("done");
    expect(byId.get("ineligible-op")).toMatchObject({
      status: "skipped",
      skipReason: "activation_not_reached",
      skipDetails: {
        activation: {
          everyNTurns: 5,
          turnsCounter: 3,
          tokensCounter: 1200,
        },
      },
    });
  });

  test("executes simple template->artifact happy path", async () => {
    const out = await executeOperationsPhase({
      runId: "run-1",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "hello",
          output: artifactOutput("greeting"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out).toHaveLength(1);
    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      opId: "a",
      artifactId: "greeting",
      value: "hello",
    });
  });

  test("emits operation.finished with operation result payload", async () => {
    const finishedEvents = collectEvents<{
      opId: string;
      status: string;
      result?: { effects: Array<{ type: string; tag?: string; value?: string }>; debugSummary?: string };
    }>();

    await executeOperationsPhase({
      runId: "run-1-finished-payload",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "hello",
          output: artifactOutput("greeting"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
      onOperationFinished: (event) => {
        finishedEvents.push({
          opId: event.opId,
          status: event.status,
          result: event.result as any,
        });
      },
    });

    const finished = finishedEvents.items.find((event) => event.opId === "a");
    expect(finished?.status).toBe("done");
    expect(finished?.result?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "greeting",
      value: "hello",
    });
    expect(finished?.result?.debugSummary).toBe("artifact.upsert:5");
  });

  test("replays dependency artifacts for A->B chain", async () => {
    const out = await executeOperationsPhase({
      runId: "run-2",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "alpha",
          output: artifactOutput("seed"),
        }),
        makeTemplateOp({
          opId: "b",
          order: 20,
          dependsOn: ["a"],
          template: "seen={{art.seed.value}}",
          output: artifactOutput("seen"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const byId = new Map(out.map((r) => [r.opId, r] as const));
    expect(byId.get("a")?.status).toBe("done");
    expect(byId.get("b")?.status).toBe("done");
    expect(byId.get("b")?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "seen",
      value: "seen=alpha",
    });
  });

  test("replays fan-in chain A->(B,C)->D", async () => {
    const out = await executeOperationsPhase({
      runId: "run-3",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "root",
          output: artifactOutput("root"),
        }),
        makeTemplateOp({
          opId: "b",
          order: 20,
          dependsOn: ["a"],
          template: "{{art.root.value}}-L",
          output: artifactOutput("left"),
        }),
        makeTemplateOp({
          opId: "c",
          order: 20,
          dependsOn: ["a"],
          template: "{{art.root.value}}-R",
          output: artifactOutput("right"),
        }),
        makeTemplateOp({
          opId: "d",
          order: 30,
          dependsOn: ["b", "c"],
          template: "{{art.left.value}}|{{art.right.value}}",
          output: artifactOutput("joined"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const joined = out.find((r) => r.opId === "d");
    expect(joined?.status).toBe("done");
    expect(joined?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "joined",
      value: "root-L|root-R",
    });
  });

  test("does not leak data between independent parallel operations", async () => {
    const out = await executeOperationsPhase({
      runId: "run-4",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "A",
          output: artifactOutput("a"),
        }),
        makeTemplateOp({
          opId: "b",
          order: 10,
          template: "{% if art.a %}leak{% else %}none{% endif %}",
          output: artifactOutput("b"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const b = out.find((r) => r.opId === "b");
    expect(b?.status).toBe("done");
    expect(b?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "b",
      value: "none",
    });
  });

  test("returns error for strictVariables with missing variable", async () => {
    const finishedEvents = collectEvents<{
      opId: string;
      status: string;
      error?: { code: string; message: string };
    }>();
    const out = await executeOperationsPhase({
      runId: "run-5",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "{{missing.value}}",
          strictVariables: true,
          output: artifactOutput("x"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
      onOperationFinished: (event) => {
        finishedEvents.push({
          opId: event.opId,
          status: event.status,
          error: event.error,
        });
      },
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.effects).toEqual([]);
    expect(out[0]?.error?.message.length).toBeGreaterThan(0);
    expect(finishedEvents.items).toEqual([
      {
        opId: "a",
        status: "error",
        error: {
          code: "OPERATION_ERROR",
          message: expect.stringContaining("missing"),
        },
      },
    ]);
  });

  test("redacts credentials from operation.finished error messages", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "error", message: "Authorization: Bearer provider-secret" },
        { type: "done", status: "error" },
      ])
    );
    const finishedEvents = collectEvents<{ error?: { code: string; message: string } }>();

    await executeOperationsPhase({
      runId: "run-redacted-error",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "redacted-error",
          order: 10,
          prompt: "summarize",
          output: artifactOutput("summary"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
      onOperationFinished: (event) => finishedEvents.push({ error: event.error }),
    });

    expect(finishedEvents.items[0]?.error).toEqual({
      code: "LLM_PROVIDER_ERROR",
      message: "Authorization: [REDACTED]",
    });
  });

  test("blocks dependent node when ancestor fails", async () => {
    const out = await executeOperationsPhase({
      runId: "run-6",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "{{missing.value}}",
          strictVariables: true,
          required: true,
          output: artifactOutput("x"),
        }),
        makeTemplateOp({
          opId: "b",
          order: 20,
          dependsOn: ["a"],
          template: "never",
          output: artifactOutput("y"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const byId = new Map(out.map((r) => [r.opId, r] as const));
    expect(byId.get("a")?.status).toBe("error");
    expect(byId.get("b")).toMatchObject({
      status: "skipped",
      skipReason: "dependency_not_done",
    });
  });

  test("executes liquid guard and stores json artifact", async () => {
    const out = await executeOperationsPhase({
      runId: "run-guard-liquid",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeGuardOp({
          opId: "guard-liquid",
          order: 10,
          engine: "liquid",
          outputContract: [{ key: "isBattle", title: "Battle" }],
          template: "{\"isBattle\": true}",
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]).toMatchObject({
      opId: "guard-liquid",
      status: "done",
    });
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      format: "json",
      value: {
        isBattle: true,
      },
    });
  });

  test("fails liquid guard when rendered output is not valid json", async () => {
    const out = await executeOperationsPhase({
      runId: "run-guard-liquid-error",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeGuardOp({
          opId: "guard-liquid",
          order: 10,
          engine: "liquid",
          outputContract: [{ key: "isBattle", title: "Battle" }],
          template: "not-json",
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("GUARD_OUTPUT_PARSE_ERROR");
  });

  test("executes aux llm guard and validates json output", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "{\"isBattle\":true}" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-guard-aux",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeGuardOp({
          opId: "guard-aux",
          order: 10,
          engine: "aux_llm",
          outputContract: [{ key: "isBattle", title: "Battle" }],
          prompt: "Return guard JSON",
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      format: "json",
      value: {
        isBattle: true,
      },
    });
  });

  test("fails aux llm guard when schema does not match output contract", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "{\"isBattle\":\"yes\"}" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-guard-aux-invalid",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeGuardOp({
          opId: "guard-aux",
          order: 10,
          engine: "aux_llm",
          outputContract: [{ key: "isBattle", title: "Battle" }],
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("GUARD_OUTPUT_VALIDATION_ERROR");
  });

  test("skips downstream operation when guard condition does not match", async () => {
    const out = await executeOperationsPhase({
      runId: "run-guard-skip",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeGuardOp({
          opId: "guard-liquid",
          order: 10,
          engine: "liquid",
          outputContract: [{ key: "isBattle", title: "Battle" }],
          template: "{\"isBattle\": false}",
        }),
        {
          ...makeTemplateOp({
            opId: "consumer",
            order: 20,
            dependsOn: ["guard-liquid"],
            template: "combat",
            output: artifactOutput("consumer_out"),
          }),
          config: {
            ...makeTemplateOp({
              opId: "consumer",
              order: 20,
              dependsOn: ["guard-liquid"],
              template: "combat",
              output: artifactOutput("consumer_out"),
            }).config,
            runConditions: [
              {
                type: "guard_output",
                sourceOpId: "guard-liquid",
                outputKey: "isBattle",
                operator: "is_true",
              },
            ],
          },
        },
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const byId = new Map(out.map((item) => [item.opId, item] as const));
    expect(byId.get("guard-liquid")?.status).toBe("done");
    expect(byId.get("consumer")).toMatchObject({
      status: "skipped",
      skipReason: "guard_not_matched",
      skipDetails: {
        guard: {
          sourceOpId: "guard-liquid",
          outputKey: "isBattle",
          operator: "is_true",
          actual: false,
        },
      },
    });
  });

  test("runs downstream operation only when all guard conditions match", async () => {
    const consumerBase = makeTemplateOp({
      opId: "consumer",
      order: 30,
      dependsOn: ["guard-a", "guard-b"],
      template: "combat-night",
      output: artifactOutput("consumer_out"),
    });
    const out = await executeOperationsPhase({
      runId: "run-guard-and",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeGuardOp({
          opId: "guard-a",
          order: 10,
          engine: "liquid",
          outputContract: [{ key: "isBattle", title: "Battle" }],
          template: "{\"isBattle\": true}",
        }),
        makeGuardOp({
          opId: "guard-b",
          order: 20,
          engine: "liquid",
          outputContract: [{ key: "isNight", title: "Night" }],
          template: "{\"isNight\": true}",
        }),
        {
          ...consumerBase,
          config: {
            ...consumerBase.config,
            runConditions: [
              {
                type: "guard_output",
                sourceOpId: "guard-a",
                outputKey: "isBattle",
                operator: "is_true",
              },
              {
                type: "guard_output",
                sourceOpId: "guard-b",
                outputKey: "isNight",
                operator: "is_true",
              },
            ],
          },
        },
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const byId = new Map(out.map((item) => [item.opId, item] as const));
    expect(byId.get("consumer")?.status).toBe("done");
    expect(byId.get("consumer")?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      value: "combat-night",
    });
  });

  test("normalizes dependency_missing to dependency_not_done when dependency is activation-skipped", async () => {
    const finishedEvents = collectEvents<{
      opId: string;
      status: string;
      skipReason?: string;
      skipDetails?: { blockedByOpIds?: string[]; blockedByReason?: string };
    }>();

    const out = await executeOperationsPhase({
      runId: "run-activation-dependency",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "A",
          output: artifactOutput("a"),
        }),
        makeTemplateOp({
          opId: "b",
          order: 20,
          dependsOn: ["a"],
          template: "B",
          output: artifactOutput("b"),
        }),
      ],
      activationSkippedByOpId: new Map([
        [
          "a",
          {
            everyNTurns: 5,
            turnsCounter: 3,
            tokensCounter: 900,
          },
        ],
      ]),
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
      onOperationFinished: (event) => {
        finishedEvents.push({
          opId: event.opId,
          status: event.status,
          skipReason: event.skipReason,
          skipDetails: event.skipDetails as any,
        });
      },
    });

    const byId = new Map(out.map((item) => [item.opId, item] as const));
    expect(byId.get("a")).toMatchObject({
      status: "skipped",
      skipReason: "activation_not_reached",
    });
    expect(byId.get("b")).toMatchObject({
      status: "skipped",
      skipReason: "dependency_not_done",
      skipDetails: {
        blockedByOpIds: ["a"],
        blockedByReason: "activation_not_reached",
      },
    });

    const bEvent = finishedEvents.items.find((event) => event.opId === "b");
    expect(bEvent).toMatchObject({
      status: "skipped",
      skipReason: "dependency_not_done",
      skipDetails: {
        blockedByOpIds: ["a"],
        blockedByReason: "activation_not_reached",
      },
    });
  });

  test("maps prompt_time outputs to expected runtime effect types", async () => {
    const out = await executeOperationsPhase({
      runId: "run-7",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "sys",
          order: 10,
          template: "S",
          output: {
            type: "prompt_time",
            promptTime: { kind: "system_update", mode: "append" },
          },
        }),
        makeTemplateOp({
          opId: "append",
          order: 20,
          template: "A",
          output: {
            type: "prompt_time",
            promptTime: { kind: "append_after_last_user", role: "system" },
          },
        }),
        makeTemplateOp({
          opId: "depth",
          order: 30,
          template: "D",
          output: {
            type: "prompt_time",
            promptTime: { kind: "insert_at_depth", depthFromEnd: 0, role: "assistant" },
          },
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const effectTypes = out.map((r) => r.effects[1]?.type);
    expect(effectTypes).toEqual([
      "prompt.system_update",
      "prompt.append_after_last_user",
      "prompt.insert_at_depth",
    ]);
  });

  test("provides replayed messages and artifacts in template debug context", async () => {
    const debugEvents = collectEvents<{
      opId: string;
      liquidContext: {
        promptSystem: string;
        messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
        art: Record<string, { value: string; history: string[] }>;
        artByOpId?: Record<string, { value: string; history: string[] }>;
      };
      rendered: string;
    }>();

    const out = await executeOperationsPhase({
      runId: "run-8",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "PROMPT",
          output: {
            type: "prompt_time",
            promptTime: { kind: "append_after_last_user", role: "system" },
          },
        }),
        makeTemplateOp({
          opId: "c",
          order: 20,
          template: "NOTE",
          output: artifactOutput("note"),
        }),
        makeTemplateOp({
          opId: "b",
          order: 30,
          dependsOn: ["a", "c"],
          template: "{{messages[2].content}}|{{art.note.value}}",
          output: artifactOutput("seen"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
      onTemplateDebug: (evt) => {
        debugEvents.push({
          opId: evt.opId,
          liquidContext: evt.liquidContext as any,
          rendered: evt.rendered,
        });
      },
    });

    const bResult = out.find((r) => r.opId === "b");
    expect(bResult?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "seen",
      value: "PROMPT|NOTE",
    });

    const bDebug = debugEvents.items.find((item) => item.opId === "b");
    expect(bDebug?.rendered).toBe("PROMPT|NOTE");
    expect(bDebug?.liquidContext.promptSystem).toBe("sys\n\nPROMPT");
    expect(bDebug?.liquidContext.messages[2]).toEqual({ role: "system", content: "PROMPT" });
    expect(bDebug?.liquidContext.art.note?.value).toBe("NOTE");
    expect(bDebug?.liquidContext.artByOpId?.c?.value).toBe("NOTE");
  });

  test("exposes promptSystem to template operations with dependency replay", async () => {
    const out = await executeOperationsPhase({
      runId: "run-prompt-system",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "sys-replace",
          order: 10,
          template: "NEW_SYS",
          output: {
            type: "prompt_time",
            promptTime: { kind: "system_update", mode: "replace" },
          },
        }),
        makeTemplateOp({
          opId: "read-system",
          order: 20,
          dependsOn: ["sys-replace"],
          template: "{{promptSystem}}",
          output: artifactOutput("seen"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const byId = new Map(out.map((item) => [item.opId, item] as const));
    expect(byId.get("read-system")?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "seen",
      value: "NEW_SYS",
    });
  });

  test("keeps template execution working when profile contains unsupported kind", async () => {
    const out = await executeOperationsPhase({
      runId: "run-9",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "a",
          order: 10,
          template: "ok",
          output: artifactOutput("ok"),
        }),
        makeComputeOp({
          opId: "compute-x",
          order: 20,
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const byId = new Map(out.map((r) => [r.opId, r] as const));
    expect(byId.get("a")?.status).toBe("done");
    expect(byId.get("compute-x")).toMatchObject({
      status: "skipped",
      skipReason: "unsupported_kind",
    });
  });

  test("executes llm->artifact happy path", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "LLM RESULT" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-1",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-a",
          order: 10,
          prompt: "hello from llm",
          output: artifactOutput("llm_tag"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      opId: "llm-a",
      status: "done",
    });
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "llm_tag",
      value: "LLM RESULT",
    });
  });

  test("strict json mode normalizes parsed JSON output", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: '{"alpha":1,"beta":[2,3]}' },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-ok",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "llm_json",
      value: '{"alpha":1,"beta":[2,3]}',
    });
  });

  test("strict json mode fails with parse error when response is not JSON", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "not-a-json" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-fail",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-fail",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("LLM_OUTPUT_PARSE_ERROR");
  });

  test("json parse mode markdown_code_block extracts JSON from fenced block", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "```json\n{\"alpha\":1}\n```" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-md",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-md",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          jsonParseMode: "markdown_code_block",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      value: "{\"alpha\":1}",
    });
  });

  test("json parse mode markdown_code_block fails when fenced block is missing", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "{\"alpha\":1}" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-md-missing",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-md-missing",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          jsonParseMode: "markdown_code_block",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("LLM_OUTPUT_EXTRACT_ERROR");
  });

  test("json parse mode custom_regex extracts JSON by capture group", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "<result>{\"alpha\":1,\"ok\":true}</result>" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-custom",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-custom",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          jsonParseMode: "custom_regex",
          jsonCustomPattern: "<result>([\\s\\S]*?)</result>",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      value: "{\"alpha\":1,\"ok\":true}",
    });
  });

  test("json parse mode custom_regex uses full match when no capture groups are provided", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "prefix {\"alpha\":1,\"ok\":true} suffix" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-custom-fullmatch",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-custom-fullmatch",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          jsonParseMode: "custom_regex",
          jsonCustomPattern: "\\{[\\s\\S]*\\}",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      value: "{\"alpha\":1,\"ok\":true}",
    });
  });

  test("json parse mode custom_regex fails when pattern does not match", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "no wrapper here" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-custom-fail",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-custom-fail",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          jsonParseMode: "custom_regex",
          jsonCustomPattern: "<result>([\\s\\S]*?)</result>",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("LLM_OUTPUT_EXTRACT_ERROR");
  });

  test("json parse mode custom_regex fails for invalid regex pattern at runtime", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "{\"alpha\":1}" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-custom-invalid-pattern",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-custom-invalid-pattern",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          jsonParseMode: "custom_regex",
          jsonCustomPattern: "(",
          output: artifactOutput("llm_json"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("LLM_OUTPUT_EXTRACT_ERROR");
  });

  test("strict json schema validation passes for matching output", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        {
          type: "delta",
          text: '{"project_name":"A","budget":100,"team":{"leader":"Lead","members_count":2},"tasks":[{"id":1,"title":"T"}]}',
        },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-schema-ok",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-schema-ok",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          strictSchemaValidation: true,
          jsonSchema: {
            project_name: "string: Название проекта",
            budget: "number: Бюджет",
            team: {
              leader: "string: Имя тимлида",
              members_count: 10,
            },
            tasks: [
              {
                id: "number: ID задачи",
                title: "string: Заголовок",
              },
            ],
          },
          output: artifactOutput("llm_json_schema"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      type: "artifact.upsert",
      artifactId: "llm_json_schema",
    });
  });

  test("strict json schema validation fails for non-matching output", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        {
          type: "delta",
          text: '{"project_name":"A","team":{"leader":"Lead","members_count":2},"tasks":[{"id":1,"title":"T"}]}',
        },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-json-schema-fail",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-json-schema-fail",
          order: 10,
          prompt: "json please",
          outputMode: "json",
          strictSchemaValidation: true,
          jsonSchema: {
            project_name: "string: Название проекта",
            budget: "number: Бюджет",
            team: {
              leader: "string: Имя тимлида",
              members_count: 10,
            },
            tasks: [
              {
                id: "number: ID задачи",
                title: "string: Заголовок",
              },
            ],
          },
          output: artifactOutput("llm_json_schema"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("LLM_OUTPUT_SCHEMA_ERROR");
  });

  test("retries llm call on provider_error and succeeds on second attempt", async () => {
    mocks.llmGatewayStream
      .mockImplementationOnce(() =>
        streamOf([
          { type: "error", message: "provider exploded" },
          { type: "done", status: "error" },
        ])
      )
      .mockImplementationOnce(() =>
        streamOf([
          { type: "delta", text: "RECOVERED" },
          { type: "done", status: "done" },
        ])
      );

    const out = await executeOperationsPhase({
      runId: "run-llm-retry",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-retry",
          order: 10,
          prompt: "retry me",
          retry: { maxAttempts: 2, retryOn: ["provider_error"] },
          output: artifactOutput("llm_retry"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("done");
    expect(out[0]?.effects[0]).toMatchObject({
      value: "RECOVERED",
    });
    expect(mocks.llmGatewayStream).toHaveBeenCalledTimes(2);
  });

  test("returns timeout error when llm attempt exceeds timeoutMs", async () => {
    mocks.llmGatewayStream.mockImplementation((req: any) =>
      (async function* () {
        await new Promise((resolve) => setTimeout(resolve, 10));
        if (req.abortSignal?.aborted) {
          yield { type: "done", status: "aborted" as const };
          return;
        }
        yield { type: "delta", text: "late" as const };
        yield { type: "done", status: "done" as const };
      })()
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-timeout",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeLlmOp({
          opId: "llm-timeout",
          order: 10,
          prompt: "slow request",
          timeoutMs: 1,
          output: artifactOutput("llm_timeout"),
        }),
      ],
      executionMode: "sequential",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.error?.code).toBe("LLM_TIMEOUT");
  });

  test("replays dependency effects into llm prompt context", async () => {
    mocks.llmGatewayStream.mockImplementation(() =>
      streamOf([
        { type: "delta", text: "OK" },
        { type: "done", status: "done" },
      ])
    );

    const out = await executeOperationsPhase({
      runId: "run-llm-deps",
      hook: "before_main_llm",
      trigger: "generate",
      operations: [
        makeTemplateOp({
          opId: "tmpl-seed",
          order: 10,
          template: "ALPHA",
          output: artifactOutput("seed"),
        }),
        makeLlmOp({
          opId: "llm-dep",
          order: 20,
          dependsOn: ["tmpl-seed"],
          prompt: "seen={{art.seed.value}}",
          output: artifactOutput("llm_seen"),
        }),
      ],
      executionMode: "concurrent",
      baseMessages: makeBaseMessages(),
      baseArtifacts: makeBaseArtifacts(),
      assistantText: "",
      templateContext: makeTemplateContext(),
    });

    const reqArgs = mocks.buildGatewayStreamRequest.mock.calls[0]?.[0];
    expect(reqArgs?.messages).toMatchObject([{ role: "user", content: "seen=ALPHA" }]);
    const llmOut = out.find((x) => x.opId === "llm-dep");
    expect(llmOut?.status).toBe("done");
  });

  test("is deterministic in concurrent mode under repeated runs", async () => {
    const operations: OperationInProfile[] = [
      makeTemplateOp({
        opId: "a_root",
        order: 10,
        template: "ROOT",
        output: artifactOutput("root"),
      }),
      makeTemplateOp({
        opId: "b_left",
        order: 20,
        dependsOn: ["a_root"],
        template: "{{art.root.value}}-L",
        output: artifactOutput("left"),
      }),
      makeTemplateOp({
        opId: "c_right",
        order: 20,
        dependsOn: ["a_root"],
        template: "{{art.root.value}}-R",
        output: artifactOutput("right"),
      }),
      makeTemplateOp({
        opId: "d_join",
        order: 30,
        dependsOn: ["b_left", "c_right"],
        template: "{{art.left.value}}/{{art.right.value}}",
        output: artifactOutput("joined"),
      }),
      makeTemplateOp({
        opId: "e_prompt",
        order: 40,
        dependsOn: ["d_join"],
        template: "J={{art.joined.value}}",
        output: {
          type: "prompt_time",
          promptTime: { kind: "append_after_last_user", role: "system" },
        },
      }),
    ];

    let baseline = "";
    for (let i = 0; i < 25; i++) {
      const out = await executeOperationsPhase({
        runId: `stress-${i}`,
        hook: "before_main_llm",
        trigger: "generate",
        operations,
        executionMode: "concurrent",
        baseMessages: makeBaseMessages(),
        baseArtifacts: makeBaseArtifacts(),
        assistantText: "",
        templateContext: makeTemplateContext(),
      });

      expect(out.map((r) => r.opId)).toEqual(["a_root", "b_left", "c_right", "d_join", "e_prompt"]);
      const serialized = JSON.stringify(out);
      if (i === 0) baseline = serialized;
      expect(serialized).toBe(baseline);
    }
  });
});

