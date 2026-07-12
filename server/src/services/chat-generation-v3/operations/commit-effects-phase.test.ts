import { afterEach, describe, expect, test, vi } from "vitest";


import { RunArtifactStore } from "../artifacts/run-artifact-store";

import { commitEffectsPhase } from "./commit-effects-phase";
import * as turnEffects from "./effect-handlers/turn-effects";

import type {
  OperationExecutionResult,
  RunState,
  RuntimeEffect,
} from "../contracts";
import type { OperationHook } from "@shared/types/operation-profiles";

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
    turnUserCanonicalizationHistory: [],
    phaseReports: [],
    promptHash: null,
    promptSnapshot: null,
    finishedStatus: null,
    failedType: null,
    errorMessage: null,
  };
}

function makeDoneResult(params: {
  opId: string;
  order: number;
  hook: OperationHook;
  required?: boolean;
  dependsOn?: string[];
  effects: RuntimeEffect[];
}): OperationExecutionResult {
  return {
    opId: params.opId,
    name: params.opId,
    required: params.required ?? false,
    hook: params.hook,
    status: "done",
    order: params.order,
    dependsOn: params.dependsOn ?? [],
    effects: params.effects,
  };
}

function collectEvents() {
  const events: Array<{
    type: "commit.effect_applied" | "commit.effect_skipped" | "commit.effect_error";
    data: { hook: OperationHook; opId: string; effectType: RuntimeEffect["type"]; message?: string };
  }> = [];
  return {
    events,
    onCommitEvent: (event: {
      type: "commit.effect_applied" | "commit.effect_skipped" | "commit.effect_error";
      data: { hook: OperationHook; opId: string; effectType: RuntimeEffect["type"]; message?: string };
    }) => {
      events.push(event);
    },
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("commit effects phase", () => {
  test("commits in deterministic dependency-first order", async () => {
    const state = makeRunState();
    state.operationResultsByHook.before_main_llm = [
      makeDoneResult({
        opId: "b",
        order: 10,
        hook: "before_main_llm",
        dependsOn: ["a"],
        effects: [
          {
            type: "prompt.append_after_last_user",
            opId: "b",
            role: "system",
            payload: "B",
          },
        ],
      }),
      makeDoneResult({
        opId: "a",
        order: 30,
        hook: "before_main_llm",
        effects: [
          {
            type: "prompt.append_after_last_user",
            opId: "a",
            role: "system",
            payload: "A",
          },
        ],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
    });

    expect(result.requiredError).toBe(false);
    expect(state.effectivePromptDraft.map((m) => m.content)).toEqual(["sys", "u", "B", "A"]);
  });

  test("applies prompt.system_update modes prepend/append/replace", async () => {
    const checkMode = async (mode: "prepend" | "append" | "replace", expected: string) => {
      const state = makeRunState();
      state.operationResultsByHook.before_main_llm = [
        makeDoneResult({
          opId: `sys-${mode}`,
          order: 10,
          hook: "before_main_llm",
          effects: [
            {
              type: "prompt.system_update",
              opId: `sys-${mode}`,
              mode,
              payload: "X",
            },
          ],
        }),
      ];

      const result = await commitEffectsPhase({
        hook: "before_main_llm",
        ownerId: "global",
        chatId: "chat",
        branchId: "branch",
        profile: null,
        sessionKey: null,
        runState: state,
        runArtifactStore: new RunArtifactStore(),
      });

      expect(result.requiredError).toBe(false);
      expect(state.effectivePromptDraft[0]?.content).toBe(expected);
    };

    await checkMode("prepend", "Xsys");
    await checkMode("append", "sysX");
    await checkMode("replace", "X");
  });

  test("reports policy violation for prompt effect in after_main_llm and flags required error", async () => {
    const state = makeRunState();
    state.operationResultsByHook.after_main_llm = [
      makeDoneResult({
        opId: "after-prompt",
        order: 10,
        hook: "after_main_llm",
        required: true,
        effects: [
          {
            type: "prompt.system_update",
            opId: "after-prompt",
            mode: "append",
            payload: "bad",
          },
        ],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
    });

    expect(result.requiredError).toBe(true);
    expect(result.report.status).toBe("error");
    expect(result.report.effects[0]).toMatchObject({
      opId: "after-prompt",
      effectType: "prompt.system_update",
      status: "error",
    });
    expect(result.report.effects[0]?.message).toMatch(/forbidden/);
  });

  test("applies assistant canonicalization after_main_llm", async () => {
    const persistSpy = vi.spyOn(turnEffects, "persistAssistantTurnText").mockResolvedValue({
      previousText: "raw",
      assistantEntryId: "assistant-entry",
      assistantMainPartId: "assistant-main-part",
    });
    const onAssistantTurnCanonicalized = vi.fn();
    const state = makeRunState();
    state.assistantText = "raw";
    state.operationResultsByHook.after_main_llm = [
      makeDoneResult({
        opId: "assistant",
        order: 10,
        hook: "after_main_llm",
        effects: [{ type: "turn.assistant.replace_text", opId: "assistant", text: "normalized" }],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      persistenceTarget: {
        mode: "entry_parts",
        assistantEntryId: "assistant-entry",
        assistantMainPartId: "assistant-main-part",
      },
      onAssistantTurnCanonicalized,
    });

    expect(result.requiredError).toBe(false);
    expect(persistSpy).toHaveBeenCalledWith({
      target: {
        mode: "entry_parts",
        assistantEntryId: "assistant-entry",
        assistantMainPartId: "assistant-main-part",
      },
      text: "normalized",
    });
    expect(state.assistantText).toBe("normalized");
    expect(onAssistantTurnCanonicalized).toHaveBeenCalledWith(
      expect.objectContaining({
        hook: "after_main_llm",
        opId: "assistant",
        assistantEntryId: "assistant-entry",
        assistantMainPartId: "assistant-main-part",
        beforeText: "raw",
        afterText: "normalized",
      })
    );
  });

  test("keeps original assistant text and marks required error when persistence fails", async () => {
    vi.spyOn(turnEffects, "persistAssistantTurnText").mockRejectedValue(
      new Error("assistant persist failure")
    );
    const state = makeRunState();
    state.assistantText = "raw";
    state.operationResultsByHook.after_main_llm = [
      makeDoneResult({
        opId: "required-assistant",
        order: 10,
        hook: "after_main_llm",
        required: true,
        effects: [
          {
            type: "turn.assistant.replace_text",
            opId: "required-assistant",
            text: "normalized",
          },
        ],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      persistenceTarget: {
        mode: "entry_parts",
        assistantEntryId: "assistant-entry",
        assistantMainPartId: "assistant-main-part",
      },
    });

    expect(result.requiredError).toBe(true);
    expect(result.report.effects[0]).toMatchObject({
      effectType: "turn.assistant.replace_text",
      status: "error",
      message: "assistant persist failure",
    });
    expect(state.assistantText).toBe("raw");
  });

  test("keeps original assistant text without failing the barrier for optional persistence", async () => {
    vi.spyOn(turnEffects, "persistAssistantTurnText").mockRejectedValue(
      new Error("optional assistant persist failure")
    );
    const state = makeRunState();
    state.assistantText = "raw";
    state.operationResultsByHook.after_main_llm = [
      makeDoneResult({
        opId: "optional-assistant",
        order: 10,
        hook: "after_main_llm",
        effects: [
          {
            type: "turn.assistant.replace_text",
            opId: "optional-assistant",
            text: "normalized",
          },
        ],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      persistenceTarget: {
        mode: "entry_parts",
        assistantEntryId: "assistant-entry",
        assistantMainPartId: "assistant-main-part",
      },
    });

    expect(result.requiredError).toBe(false);
    expect(result.report.status).toBe("done");
    expect(result.report.effects[0]?.status).toBe("error");
    expect(state.assistantText).toBe("raw");
  });

  test("invokes user turn persistence handler and reports applied event", async () => {
    const persistSpy = vi
      .spyOn(turnEffects, "persistUserTurnText")
      .mockResolvedValue({
        previousText: "original user",
        replacedPartId: "user-main-part-1",
        canonicalPartId: "canon-main-part-1",
        userEntryId: "user-entry-1",
      });
    const state = makeRunState();
    state.operationResultsByHook.after_main_llm = [
      makeDoneResult({
        opId: "user",
        order: 10,
        hook: "after_main_llm",
        effects: [{ type: "turn.user.replace_text", opId: "user", text: "normalized user" }],
      }),
    ];
    const collected = collectEvents();

    const result = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      userTurnTarget: {
        mode: "entry_parts",
        userEntryId: "user-entry-1",
        userMainPartId: "user-main-part-1",
      },
      onCommitEvent: collected.onCommitEvent,
    });

    expect(result.requiredError).toBe(false);
    expect(persistSpy).toHaveBeenCalledWith({
      target: {
        mode: "entry_parts",
        userEntryId: "user-entry-1",
        userMainPartId: "user-main-part-1",
      },
      text: "normalized user",
    });
    expect(state.turnUserCanonicalizationHistory).toEqual([
      expect.objectContaining({
        hook: "after_main_llm",
        opId: "user",
        userEntryId: "user-entry-1",
        userMainPartId: "user-main-part-1",
        replacedPartId: "user-main-part-1",
        canonicalPartId: "canon-main-part-1",
        beforeText: "original user",
        afterText: "normalized user",
      }),
    ]);
    expect(result.report.effects[0]).toMatchObject({
      opId: "user",
      effectType: "turn.user.replace_text",
      status: "applied",
    });
    expect(collected.events).toContainEqual({
      type: "commit.effect_applied",
      data: {
        hook: "after_main_llm",
        opId: "user",
        effectType: "turn.user.replace_text",
      },
    });
  });

  test("applies user canonicalization to current prompt draft in before_main_llm", async () => {
    const persistSpy = vi
      .spyOn(turnEffects, "persistUserTurnText")
      .mockResolvedValue({
        previousText: "u",
        replacedPartId: "user-main-part-before",
        canonicalPartId: "canon-main-part-before",
        userEntryId: "user-entry-before",
      });
    const onUserTurnCanonicalized = vi.fn();
    const state = makeRunState();
    state.operationResultsByHook.before_main_llm = [
      makeDoneResult({
        opId: "user-before",
        order: 10,
        hook: "before_main_llm",
        effects: [{ type: "turn.user.replace_text", opId: "user-before", text: "updated now" }],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      userTurnTarget: {
        mode: "entry_parts",
        userEntryId: "user-entry-before",
        userMainPartId: "user-main-part-before",
      },
      onUserTurnCanonicalized,
    });

    expect(result.requiredError).toBe(false);
    expect(persistSpy).toHaveBeenCalledWith({
      target: {
        mode: "entry_parts",
        userEntryId: "user-entry-before",
        userMainPartId: "user-main-part-before",
      },
      text: "updated now",
    });
    expect(state.effectivePromptDraft).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "updated now" },
    ]);
    expect(state.turnUserCanonicalizationHistory).toEqual([
      expect.objectContaining({
        hook: "before_main_llm",
        opId: "user-before",
        userEntryId: "user-entry-before",
        userMainPartId: "user-main-part-before",
        replacedPartId: "user-main-part-before",
        canonicalPartId: "canon-main-part-before",
        beforeText: "u",
        afterText: "updated now",
      }),
    ]);
    expect(onUserTurnCanonicalized).toHaveBeenCalledWith(
      expect.objectContaining({
        opId: "user-before",
        beforeText: "u",
        afterText: "updated now",
      })
    );
  });

  test("updates user turn target between multiple canonicalization effects", async () => {
    const persistSpy = vi.spyOn(turnEffects, "persistUserTurnText");
    persistSpy
      .mockResolvedValueOnce({
        previousText: "raw-1",
        replacedPartId: "user-main-part-1",
        canonicalPartId: "canon-main-part-1",
        userEntryId: "user-entry-1",
      })
      .mockResolvedValueOnce({
        previousText: "raw-2",
        replacedPartId: "canon-main-part-1",
        canonicalPartId: "canon-main-part-2",
        userEntryId: "user-entry-1",
      });

    const state = makeRunState();
    state.operationResultsByHook.before_main_llm = [
      makeDoneResult({
        opId: "canon-a",
        order: 10,
        hook: "before_main_llm",
        effects: [{ type: "turn.user.replace_text", opId: "canon-a", text: "A" }],
      }),
      makeDoneResult({
        opId: "canon-b",
        order: 20,
        hook: "before_main_llm",
        effects: [{ type: "turn.user.replace_text", opId: "canon-b", text: "B" }],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      userTurnTarget: {
        mode: "entry_parts",
        userEntryId: "user-entry-1",
        userMainPartId: "user-main-part-1",
      },
    });

    expect(result.requiredError).toBe(false);
    expect(persistSpy).toHaveBeenNthCalledWith(1, {
      target: {
        mode: "entry_parts",
        userEntryId: "user-entry-1",
        userMainPartId: "user-main-part-1",
      },
      text: "A",
    });
    expect(persistSpy).toHaveBeenNthCalledWith(2, {
      target: {
        mode: "entry_parts",
        userEntryId: "user-entry-1",
        userMainPartId: "canon-main-part-1",
      },
      text: "B",
    });
  });

  test("marks required error when user turn persistence handler fails", async () => {
    vi.spyOn(turnEffects, "persistUserTurnText").mockRejectedValue(new Error("persist failure"));
    const state = makeRunState();
    state.operationResultsByHook.after_main_llm = [
      makeDoneResult({
        opId: "required-user",
        order: 10,
        hook: "after_main_llm",
        required: true,
        effects: [{ type: "turn.user.replace_text", opId: "required-user", text: "x" }],
      }),
    ];
    const collected = collectEvents();

    const result = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      userTurnTarget: {
        mode: "entry_parts",
        userEntryId: "user-entry-2",
        userMainPartId: "user-main-part-2",
      },
      onCommitEvent: collected.onCommitEvent,
    });

    expect(result.requiredError).toBe(true);
    expect(result.report.status).toBe("error");
    expect(result.report.effects[0]).toMatchObject({
      opId: "required-user",
      effectType: "turn.user.replace_text",
      status: "error",
      message: "persist failure",
    });
    expect(collected.events).toContainEqual({
      type: "commit.effect_error",
      data: {
        hook: "after_main_llm",
        opId: "required-user",
        effectType: "turn.user.replace_text",
        message: "persist failure",
      },
    });
  });

  test("applies run_only artifact upserts and appends history", async () => {
    const state = makeRunState();
    state.operationResultsByHook.before_main_llm = [
      makeDoneResult({
        opId: "artifact-1",
        order: 10,
        hook: "before_main_llm",
        effects: [
          {
            type: "artifact.upsert",
            opId: "artifact-1",
            artifactId: "memory",
            format: "markdown",
            persistence: "run_only",
            writeMode: "replace",
            history: { enabled: true, maxItems: 20 },
            semantics: "intermediate",
            value: "v1",
          },
        ],
      }),
      makeDoneResult({
        opId: "artifact-2",
        order: 20,
        hook: "before_main_llm",
        dependsOn: ["artifact-1"],
        effects: [
          {
            type: "artifact.upsert",
            opId: "artifact-2",
            artifactId: "memory",
            format: "markdown",
            persistence: "run_only",
            writeMode: "replace",
            history: { enabled: true, maxItems: 20 },
            semantics: "intermediate",
            value: "v2",
          },
        ],
      }),
    ];

    const runArtifactStore = new RunArtifactStore();
    const result = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore,
    });

    expect(result.requiredError).toBe(false);
    expect(state.runArtifacts.memory).toMatchObject({
      persistence: "run_only",
      value: "v2",
      history: ["v1", "v2"],
    });
  });

  test("returns required error for persisted artifact write without session key", async () => {
    const state = makeRunState();
    state.operationResultsByHook.after_main_llm = [
      makeDoneResult({
        opId: "persisted",
        order: 10,
        hook: "after_main_llm",
        required: true,
        effects: [
          {
            type: "artifact.upsert",
            opId: "persisted",
            artifactId: "state",
            format: "markdown",
            persistence: "persisted",
            writeMode: "replace",
            history: { enabled: true, maxItems: 20 },
            semantics: "state",
            value: "v",
          },
        ],
      }),
    ];

    const result = await commitEffectsPhase({
      hook: "after_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
    });

    expect(result.requiredError).toBe(true);
    expect(result.report.status).toBe("error");
    expect(result.report.effects[0]).toMatchObject({
      opId: "persisted",
      effectType: "artifact.upsert",
      status: "error",
    });
    expect(result.report.effects[0]?.message).toMatch(/without session key/);
  });

  test("ignores non-done operation results during commit", async () => {
    const state = makeRunState();
    state.operationResultsByHook.before_main_llm = [
      {
        opId: "err",
        name: "err",
        required: false,
        hook: "before_main_llm",
        status: "error",
        order: 10,
        dependsOn: [],
        effects: [
          {
            type: "prompt.append_after_last_user",
            opId: "err",
            role: "system",
            payload: "should-not-apply",
          },
        ],
        error: { code: "X", message: "boom" },
      },
      {
        opId: "skip",
        name: "skip",
        required: false,
        hook: "before_main_llm",
        status: "skipped",
        order: 20,
        dependsOn: [],
        effects: [
          {
            type: "artifact.upsert",
            opId: "skip",
            artifactId: "x",
            format: "markdown",
            persistence: "run_only",
            writeMode: "replace",
            history: { enabled: true, maxItems: 20 },
            semantics: "intermediate",
            value: "v",
          },
        ],
        skipReason: "dependency_not_done",
      },
      {
        opId: "abort",
        name: "abort",
        required: false,
        hook: "before_main_llm",
        status: "aborted",
        order: 30,
        dependsOn: [],
        effects: [
          {
            type: "prompt.system_update",
            opId: "abort",
            mode: "append",
            payload: "bad",
          },
        ],
      },
    ];

    const collected = collectEvents();
    const result = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      onCommitEvent: collected.onCommitEvent,
    });

    expect(result.requiredError).toBe(false);
    expect(result.report.status).toBe("done");
    expect(result.report.effects).toEqual([]);
    expect(state.effectivePromptDraft.map((m) => m.content)).toEqual(["sys", "u"]);
    expect(state.runArtifacts).toEqual({});
    expect(collected.events).toEqual([]);
  });

  test("emits commit events in deterministic applied/error order", async () => {
    const state = makeRunState();
    state.operationResultsByHook.before_main_llm = [
      makeDoneResult({
        opId: "b",
        order: 10,
        hook: "before_main_llm",
        dependsOn: ["a"],
        effects: [
          {
            type: "prompt.append_after_last_user",
            opId: "b",
            role: "system",
            payload: "B",
          },
        ],
      }),
      makeDoneResult({
        opId: "a",
        order: 30,
        hook: "before_main_llm",
        effects: [
          {
            type: "prompt.append_after_last_user",
            opId: "a",
            role: "system",
            payload: "A",
          },
        ],
      }),
      makeDoneResult({
        opId: "c",
        order: 40,
        hook: "before_main_llm",
        effects: [
          {
            type: "artifact.upsert",
            opId: "c",
            artifactId: "x",
            format: "markdown",
            persistence: "persisted",
            writeMode: "replace",
            history: { enabled: true, maxItems: 20 },
            semantics: "intermediate",
            value: "v",
          },
        ],
      }),
    ];
    const collected = collectEvents();

    const result = await commitEffectsPhase({
      hook: "before_main_llm",
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      profile: null,
      sessionKey: null,
      runState: state,
      runArtifactStore: new RunArtifactStore(),
      onCommitEvent: collected.onCommitEvent,
    });

    expect(result.requiredError).toBe(false);
    expect(
      collected.events.map((e) => `${e.type}:${e.data.opId}:${e.data.effectType}`)
    ).toEqual([
      "commit.effect_applied:a:prompt.append_after_last_user",
      "commit.effect_applied:b:prompt.append_after_last_user",
      "commit.effect_error:c:artifact.upsert",
    ]);
  });
});
