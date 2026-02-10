import { describe, expect, test } from "vitest";

import type { OperationInProfile, OperationOutput } from "@shared/types/operation-profiles";

import type { PromptTemplateRenderContext } from "../../chat-core/prompt-template-renderer";
import { executeOperationsPhase } from "./execute-operations-phase";

type TemplateOp = Extract<OperationInProfile, { kind: "template" }>;

function makeTemplateContext(): PromptTemplateRenderContext {
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

function artifactOutput(tag: string): OperationOutput {
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
  output: OperationOutput;
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
        output: params.output,
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
        params: { noop: true },
        output: artifactOutput(`compute_${params.opId}`),
      },
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

describe("executeOperationsPhase", () => {
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
      tag: "greeting",
      value: "hello",
    });
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
      tag: "seen",
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
      tag: "joined",
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
      tag: "b",
      value: "none",
    });
  });

  test("returns error for strictVariables with missing variable", async () => {
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
    });

    expect(out[0]?.status).toBe("error");
    expect(out[0]?.effects).toEqual([]);
    expect(out[0]?.error?.message.length).toBeGreaterThan(0);
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
            promptTime: { kind: "append_after_last_user", role: "developer" },
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

    const effectTypes = out.map((r) => r.effects[0]?.type);
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
        messages: Array<{ role: "system" | "developer" | "user" | "assistant"; content: string }>;
        art: Record<string, { value: string; history: string[] }>;
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
            promptTime: { kind: "append_after_last_user", role: "developer" },
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
      tag: "seen",
      value: "PROMPT|NOTE",
    });

    const bDebug = debugEvents.items.find((item) => item.opId === "b");
    expect(bDebug?.rendered).toBe("PROMPT|NOTE");
    expect(bDebug?.liquidContext.messages[2]).toEqual({ role: "developer", content: "PROMPT" });
    expect(bDebug?.liquidContext.art.note?.value).toBe("NOTE");
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
          promptTime: { kind: "append_after_last_user", role: "developer" },
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
