import { describe, expect, test } from "vitest";

import type { OperationInProfile, OperationOutput } from "@shared/types/operation-profiles";

import type { PromptTemplateRenderContext } from "../../chat-core/prompt-template-renderer";
import { RunArtifactStore } from "../artifacts/run-artifact-store";
import type { RunState } from "../contracts";
import { commitEffectsPhase } from "./commit-effects-phase";
import { executeOperationsPhase } from "./execute-operations-phase";

type TemplateOp = Extract<OperationInProfile, { kind: "template" }>;

function makeTemplateContext(): PromptTemplateRenderContext {
  return {
    char: {},
    user: {},
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  };
}

function makeRunState(): RunState {
  return {
    basePromptDraft: [
      { role: "system", content: "sys" },
      { role: "user", content: "u" },
    ],
    effectivePromptDraft: [
      { role: "system", content: "sys" },
      { role: "user", content: "u" },
    ],
    llmMessages: [],
    assistantText: "",
    assistantReasoningText: "",
    runArtifacts: {},
    persistedArtifactsSnapshot: {},
    operationResultsByHook: {
      before_main_llm: [],
      after_main_llm: [],
    },
    commitReportsByHook: {},
    phaseReports: [],
    promptHash: null,
    promptSnapshot: null,
    finishedStatus: null,
    failedType: null,
    errorMessage: null,
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
  hooks: Array<"before_main_llm" | "after_main_llm">;
  dependsOn?: string[];
  required?: boolean;
}): TemplateOp {
  return {
    opId: params.opId,
    name: params.opId,
    kind: "template",
    config: {
      enabled: true,
      required: params.required ?? false,
      hooks: params.hooks,
      triggers: ["generate", "regenerate"],
      order: params.order,
      dependsOn: params.dependsOn,
      params: {
        template: params.template,
        output: params.output,
      },
    },
  };
}

function toExecuteArtifacts(runState: RunState): Record<string, { value: string; history: string[] }> {
  const merged = { ...runState.persistedArtifactsSnapshot, ...runState.runArtifacts };
  return Object.fromEntries(
    Object.entries(merged).map(([tag, value]) => [
      tag,
      { value: value.value, history: [...value.history] },
    ])
  );
}

function collectEvents() {
  const events: Array<{
    type: "commit.effect_applied" | "commit.effect_skipped" | "commit.effect_error";
    data: { hook: "before_main_llm" | "after_main_llm"; opId: string; effectType: string; message?: string };
  }> = [];
  return {
    events,
    onCommitEvent: (event: {
      type: "commit.effect_applied" | "commit.effect_skipped" | "commit.effect_error";
      data: { hook: "before_main_llm" | "after_main_llm"; opId: string; effectType: string; message?: string };
    }) => {
      events.push(event);
    },
  };
}

describe("operations flow integration (execute + commit)", () => {
  test("before artifacts and prompt injection are visible in after phase and canonicalize assistant", async () => {
    const runState = makeRunState();
    const runArtifactStore = new RunArtifactStore();
    const templateContext = makeTemplateContext();

    const beforeOps: OperationInProfile[] = [
      makeTemplateOp({
        opId: "before-artifact",
        order: 10,
        hooks: ["before_main_llm"],
        template: "WORLD",
        output: artifactOutput("world_state"),
      }),
      makeTemplateOp({
        opId: "before-prompt",
        order: 20,
        hooks: ["before_main_llm"],
        dependsOn: ["before-artifact"],
        template: "note={{art.world_state.value}}",
        output: {
          type: "prompt_time",
          promptTime: {
            kind: "append_after_last_user",
            role: "developer",
            source: "art.world_state",
          },
        },
      }),
    ];

    const beforeExec = await executeOperationsPhase({
      runId: "flow-1",
      hook: "before_main_llm",
      trigger: "generate",
      operations: beforeOps,
      executionMode: "concurrent",
      baseMessages: runState.effectivePromptDraft,
      baseArtifacts: toExecuteArtifacts(runState),
      assistantText: runState.assistantText,
      templateContext,
    });
    runState.operationResultsByHook.before_main_llm = beforeExec;

    const beforeCommit = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      profile: null,
      sessionKey: null,
      runState,
      runArtifactStore,
    });

    expect(beforeCommit.requiredError).toBe(false);
    expect(runState.runArtifacts.world_state?.value).toBe("WORLD");
    expect(runState.effectivePromptDraft.map((m) => `${m.role}:${m.content}`)).toEqual([
      "system:sys",
      "user:u",
      "developer:note=WORLD",
    ]);

    runState.assistantText = "raw";
    const templateDebug: Array<{
      opId: string;
      liquidContext: { art: Record<string, { value: string; history: string[] }> };
    }> = [];
    const afterOps: OperationInProfile[] = [
      makeTemplateOp({
        opId: "after-canon",
        order: 10,
        hooks: ["after_main_llm"],
        template: "FINAL {{art.world_state.value}}",
        output: {
          type: "turn_canonicalization",
          canonicalization: { kind: "replace_text", target: "assistant" },
        },
      }),
    ];

    const afterExec = await executeOperationsPhase({
      runId: "flow-1",
      hook: "after_main_llm",
      trigger: "generate",
      operations: afterOps,
      executionMode: "sequential",
      baseMessages: [
        ...runState.effectivePromptDraft.map((m) => ({ ...m })),
        { role: "assistant", content: runState.assistantText },
      ],
      baseArtifacts: toExecuteArtifacts(runState),
      assistantText: runState.assistantText,
      templateContext,
      onTemplateDebug: (event) => {
        templateDebug.push({ opId: event.opId, liquidContext: event.liquidContext as any });
      },
    });
    runState.operationResultsByHook.after_main_llm = afterExec;

    const afterCommit = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      profile: null,
      sessionKey: null,
      runState,
      runArtifactStore,
    });

    expect(afterCommit.requiredError).toBe(false);
    expect(runState.assistantText).toBe("FINAL WORLD");
    expect(templateDebug.find((x) => x.opId === "after-canon")?.liquidContext.art.world_state?.value).toBe(
      "WORLD"
    );
  });

  test("required policy violation in after commit is surfaced as commit error", async () => {
    const runState = makeRunState();
    runState.assistantText = "raw";
    const runArtifactStore = new RunArtifactStore();
    const events = collectEvents();

    const afterOps: OperationInProfile[] = [
      makeTemplateOp({
        opId: "after-invalid-required",
        order: 10,
        hooks: ["after_main_llm"],
        required: true,
        template: "should-not-apply",
        output: {
          type: "prompt_time",
          promptTime: { kind: "system_update", mode: "append", source: "invalid_after" },
        },
      }),
    ];

    const afterExec = await executeOperationsPhase({
      runId: "flow-2",
      hook: "after_main_llm",
      trigger: "generate",
      operations: afterOps,
      executionMode: "sequential",
      baseMessages: [
        ...runState.effectivePromptDraft.map((m) => ({ ...m })),
        { role: "assistant", content: runState.assistantText },
      ],
      baseArtifacts: toExecuteArtifacts(runState),
      assistantText: runState.assistantText,
      templateContext: makeTemplateContext(),
    });
    runState.operationResultsByHook.after_main_llm = afterExec;

    const afterCommit = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat-2",
      branchId: "branch-2",
      profile: null,
      sessionKey: null,
      runState,
      runArtifactStore,
      onCommitEvent: events.onCommitEvent,
    });

    expect(afterCommit.requiredError).toBe(true);
    expect(afterCommit.report.status).toBe("error");
    expect(afterCommit.report.effects[0]).toMatchObject({
      opId: "after-invalid-required",
      effectType: "prompt.system_update",
      status: "error",
    });
    expect(runState.effectivePromptDraft.map((m) => m.content)).toEqual(["sys", "u"]);
    expect(events.events).toContainEqual({
      type: "commit.effect_error",
      data: {
        hook: "after_main_llm",
        opId: "after-invalid-required",
        effectType: "prompt.system_update",
        message: expect.stringMatching(/forbidden/),
      },
    });
  });
});
