import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRunContext: vi.fn(),
  buildBasePrompt: vi.fn(),
  executeOperationsPhase: vi.fn(),
  commitEffectsPhase: vi.fn(),
  runMainLlmPhase: vi.fn(),
  generationControlAcquire: vi.fn(),
  profileSessionArtifactLoad: vi.fn(),
  finalizeRun: vi.fn(),
  updateGenerationPromptData: vi.fn(),
  updateGenerationDebugJson: vi.fn(),
  loadOrBootstrapRuntimeState: vi.fn(),
  chatRuntimeStateUpsert: vi.fn(),
}));

vi.mock("./prepare/resolve-run-context", () => ({
  resolveRunContext: mocks.resolveRunContext,
}));

vi.mock("./prompt/build-base-prompt", () => ({
  buildBasePrompt: mocks.buildBasePrompt,
}));

vi.mock("./operations/execute-operations-phase", () => ({
  executeOperationsPhase: mocks.executeOperationsPhase,
}));

vi.mock("./operations/commit-effects-phase", () => ({
  commitEffectsPhase: mocks.commitEffectsPhase,
}));

vi.mock("./main-llm/run-main-llm-phase", () => ({
  runMainLlmPhase: mocks.runMainLlmPhase,
}));

vi.mock("./control/generation-control-port", () => ({
  defaultGenerationControlPort: {
    acquire: mocks.generationControlAcquire,
  },
}));

vi.mock("./persist/finalize-run", () => ({
  finalizeRun: mocks.finalizeRun,
}));

vi.mock("./runtime/operation-runtime-state", () => ({
  loadOrBootstrapRuntimeState: mocks.loadOrBootstrapRuntimeState,
}));

vi.mock("./runtime/chat-runtime-state-repository", () => ({
  ChatRuntimeStateRepository: {
    upsert: mocks.chatRuntimeStateUpsert,
  },
}));

vi.mock("../chat-core/generations-repository", () => ({
  updateGenerationPromptData: mocks.updateGenerationPromptData,
  updateGenerationDebugJson: mocks.updateGenerationDebugJson,
}));

vi.mock("../chat-core/generation-runtime", () => ({
  registerGeneration: vi.fn(),
  unregisterGeneration: vi.fn(),
}));

vi.mock("./artifacts/profile-session-artifact-store", () => ({
  ProfileSessionArtifactStore: {
    load: mocks.profileSessionArtifactLoad,
    loadOperationActivationStates: vi.fn(async () => ({})),
    upsertOperationActivationState: vi.fn(async () => undefined),
  },
}));

import { runChatGenerationV3 } from "./run-chat-generation-v3";

function makeRequest() {
  return {
    ownerId: "global",
    chatId: "chat-1",
    branchId: "branch-1",
    entityProfileId: "entity-1",
    trigger: "generate" as const,
    source: "user_message" as const,
    settings: {},
    persistenceTarget: {
      mode: "entry_parts" as const,
      assistantEntryId: "assistant-entry",
      assistantMainPartId: "assistant-main-part",
    },
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.clearAllMocks();

  mocks.resolveRunContext.mockResolvedValue({
    context: {
      ownerId: "global",
      runId: "gen-1",
      generationId: "gen-1",
      trigger: "generate",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "entity-1",
      profileSnapshot: {
        profileId: "profile-1",
        version: 1,
        executionMode: "sequential",
        operationProfileSessionId: "sess-1",
        operations: [],
      },
      runtimeInfo: { providerId: "openrouter", model: "m" },
      sessionKey: "k",
      historyLimit: 50,
      startedAt: Date.now(),
    },
    profile: null,
  });

  mocks.buildBasePrompt.mockResolvedValue({
    prompt: {
      systemPrompt: "sys",
      historyReturnedCount: 1,
      promptHash: "h",
      promptSnapshot: {
        v: 1,
        messages: [],
        truncated: false,
        meta: { historyLimit: 50, historyReturnedCount: 1 },
      },
      llmMessages: [{ role: "system", content: "sys" }],
      draftMessages: [{ role: "system", content: "sys" }],
    },
    templateContext: {
      char: {},
      user: {},
      chat: {},
      messages: [],
      rag: {},
      art: {},
      now: new Date().toISOString(),
    },
    worldInfoDiagnostics: {
      worldInfoBefore: "",
      worldInfoAfter: "",
      depthEntries: [],
      outletEntries: {},
      anTop: [],
      anBottom: [],
      emTop: [],
      emBottom: [],
      warnings: [],
      activatedCount: 0,
      activatedEntries: [],
    },
    instructionDerivedSettings: {},
  });
  mocks.loadOrBootstrapRuntimeState.mockResolvedValue({
    payload: {
      version: 1,
      activationByOpId: {},
      bootstrap: {
        source: "branch_active_history",
        userEventsCount: 0,
        lastRebuiltAt: "2026-02-01T00:00:00.000Z",
      },
    },
    updatedAt: new Date("2026-02-01T00:00:00.000Z"),
  });
  mocks.chatRuntimeStateUpsert.mockImplementation(async ({ payload }: any) => ({
    payload,
    updatedAt: new Date("2026-02-01T00:00:01.000Z"),
  }));
  mocks.generationControlAcquire.mockResolvedValue({
    heartbeat: vi.fn(async () => undefined),
    release: vi.fn(async () => undefined),
  });
  mocks.profileSessionArtifactLoad.mockResolvedValue({});
});

describe("runChatGenerationV3", () => {
  test("reports preparation errors that happen before a generation exists", async () => {
    mocks.resolveRunContext.mockRejectedValueOnce(new Error("profile compilation failed"));

    const events: any[] = [];
    for await (const event of runChatGenerationV3(makeRequest())) {
      events.push(event);
    }

    expect(events).toEqual([
      expect.objectContaining({
        type: "run.preparation_failed",
        data: {
          generationId: null,
          status: "error",
          code: "generation_preparation_error",
          message: "profile compilation failed",
        },
      }),
    ]);
    expect(mocks.generationControlAcquire).not.toHaveBeenCalled();
    expect(mocks.finalizeRun).not.toHaveBeenCalled();
  });

  test("finalizes and reports a generation when control lease acquisition fails", async () => {
    mocks.generationControlAcquire.mockRejectedValueOnce(new Error("control lease failed"));

    const events: any[] = [];
    for await (const event of runChatGenerationV3(makeRequest())) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["run.started", "run.finished"]);
    expect(events[1]?.data).toMatchObject({
      generationId: "gen-1",
      status: "error",
      message: "control lease failed",
    });
    expect(mocks.finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ generationId: "gen-1" }),
        result: expect.objectContaining({
          generationId: "gen-1",
          status: "error",
          errorMessage: "control lease failed",
        }),
      })
    );
  });

  test("finalizes and reports a generation when persisted artifacts fail to load", async () => {
    mocks.profileSessionArtifactLoad.mockRejectedValueOnce(new Error("artifact load failed"));

    const events: any[] = [];
    for await (const event of runChatGenerationV3(makeRequest())) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(["run.started", "run.finished"]);
    expect(events[1]?.data).toMatchObject({
      generationId: "gen-1",
      status: "error",
      message: "artifact load failed",
    });
    expect(mocks.finalizeRun).toHaveBeenCalledWith(
      expect.objectContaining({
        result: expect.objectContaining({
          generationId: "gen-1",
          status: "error",
          errorMessage: "artifact load failed",
        }),
      })
    );
  });

  test("does not start main LLM when before barrier fails", async () => {
    mocks.executeOperationsPhase.mockResolvedValueOnce([
      {
        opId: "op-1",
        name: "op",
        required: true,
        hook: "before_main_llm",
        status: "error",
        order: 10,
        dependsOn: [],
        effects: [],
      },
    ]);
    mocks.commitEffectsPhase.mockResolvedValueOnce({
      report: { hook: "before_main_llm", status: "done", effects: [] },
      requiredError: false,
    });

    const events = [];
    for await (const evt of runChatGenerationV3(makeRequest())) {
      events.push(evt);
    }

    expect(mocks.runMainLlmPhase).not.toHaveBeenCalled();
    const types = events.map((e) => e.type);
    expect(types).not.toContain("main_llm.started");
    const finished = events.find((e) => e.type === "run.finished");
    expect(finished?.data.status).toBe("failed");
    expect(finished?.data.failedType).toBe("before_barrier");
    expect(finished?.data.message).toBe(
      "Required before operation did not finish with done: op-1"
    );
  });

  test("does not fail before barrier for required activation_not_reached skip", async () => {
    mocks.executeOperationsPhase.mockResolvedValueOnce([
      {
        opId: "required-op",
        name: "Required op",
        required: true,
        hook: "before_main_llm",
        status: "skipped",
        skipReason: "activation_not_reached",
        skipDetails: {
          activation: {
            everyNTurns: 5,
            turnsCounter: 2,
            tokensCounter: 300,
          },
        },
        order: 10,
        dependsOn: [],
        effects: [],
      },
    ]);
    mocks.executeOperationsPhase.mockResolvedValueOnce([]);
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    const events = [];
    for await (const evt of runChatGenerationV3(makeRequest())) {
      events.push(evt);
    }

    expect(mocks.runMainLlmPhase).toHaveBeenCalled();
    const finished = events.find((e) => e.type === "run.finished");
    expect(finished?.data.status).toBe("done");
  });

  test("passes before artifacts into after execute phase", async () => {
    const executeCalls: any[] = [];
    mocks.executeOperationsPhase.mockImplementation(async (params: any) => {
      executeCalls.push(params);
      return [];
    });

    mocks.commitEffectsPhase.mockImplementation(async (params: any) => {
      if (params.hook === "before_main_llm") {
        params.runState.runArtifacts = {
          world_state: {
            persistence: "run_only",
            usage: "internal",
            semantics: "intermediate",
            value: "from_before",
            history: ["from_before"],
          },
        };
      }
      return {
        report: { hook: params.hook, status: "done", effects: [] },
        requiredError: false,
      };
    });

    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    for await (const _evt of runChatGenerationV3(makeRequest())) {
      // consume
    }

    const afterCall = executeCalls.find((c) => c.hook === "after_main_llm");
    expect(afterCall).toBeTruthy();
    expect(afterCall.baseArtifacts.world_state.value).toBe("from_before");
  });

  test("streams main_llm.delta before main phase completes", async () => {
    const mainGate = deferred<void>();
    mocks.executeOperationsPhase.mockResolvedValue([]);
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockImplementation(async ({ onDelta }: any) => {
      onDelta("hello");
      await mainGate.promise;
      return { status: "done" };
    });

    const events: any[] = [];
    let resolveDeltaSeen!: () => void;
    const deltaSeen = new Promise<void>((resolve) => {
      resolveDeltaSeen = resolve;
    });

    const consume = (async () => {
      for await (const evt of runChatGenerationV3(makeRequest())) {
        events.push(evt);
        if (evt.type === "main_llm.delta") resolveDeltaSeen();
      }
    })();

    await Promise.race([
      deltaSeen,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timed out waiting for main_llm.delta")), 500)
      ),
    ]);

    expect(events.some((evt) => evt.type === "main_llm.delta")).toBe(true);

    mainGate.resolve();
    await consume;
  });

  test("streams operation started/finished while execute phase is still running", async () => {
    const executeBeforeGate = deferred<void>();
    mocks.executeOperationsPhase.mockImplementation(async (params: any) => {
      if (params.hook === "before_main_llm") {
        params.onOperationStarted?.({
          hook: "before_main_llm",
          opId: "op-1",
          name: "Op 1",
        });
        params.onOperationFinished?.({
          hook: "before_main_llm",
          opId: "op-1",
          name: "Op 1",
          status: "done",
        });
        await executeBeforeGate.promise;
        return [
          {
            opId: "op-1",
            name: "Op 1",
            required: false,
            hook: "before_main_llm",
            status: "done",
            order: 1,
            dependsOn: [],
            effects: [],
          },
        ];
      }
      return [];
    });
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    const events: any[] = [];
    let sawStarted = false;
    let sawFinished = false;
    let resolveOperationEvents!: () => void;
    const operationEventsSeen = new Promise<void>((resolve) => {
      resolveOperationEvents = resolve;
    });

    const consume = (async () => {
      for await (const evt of runChatGenerationV3(makeRequest())) {
        events.push(evt);
        if (evt.type === "operation.started") sawStarted = true;
        if (evt.type === "operation.finished") sawFinished = true;
        if (sawStarted && sawFinished) resolveOperationEvents();
      }
    })();

    await Promise.race([
      operationEventsSeen,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Timed out waiting for operation.started/operation.finished")),
          500
        )
      ),
    ]);

    expect(events.some((evt) => evt.type === "operation.started")).toBe(true);
    expect(events.some((evt) => evt.type === "operation.finished")).toBe(true);

    executeBeforeGate.resolve();
    await consume;
  });

  test("passes operation.finished result payload through run events", async () => {
    mocks.executeOperationsPhase.mockImplementation(async (params: any) => {
      if (params.hook === "before_main_llm") {
        params.onOperationFinished?.({
          hook: "before_main_llm",
          opId: "op-with-result",
          name: "Op with result",
          status: "done",
          result: {
            effects: [{ type: "artifact.upsert", opId: "op-with-result", tag: "x", value: "ok" }],
            debugSummary: "artifact.upsert:2",
          },
        });
      }
      return [];
    });
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    const events: any[] = [];
    for await (const evt of runChatGenerationV3(makeRequest())) {
      events.push(evt);
    }

    const finished = events.find(
      (evt) => evt.type === "operation.finished" && evt.data?.opId === "op-with-result"
    );
    expect(finished?.data?.status).toBe("done");
    expect(finished?.data?.result?.debugSummary).toBe("artifact.upsert:2");
    expect(finished?.data?.result?.effects?.[0]).toMatchObject({
      type: "artifact.upsert",
      opId: "op-with-result",
      tag: "x",
      value: "ok",
    });
  });

  test("passes operation.finished skip details through run events", async () => {
    mocks.executeOperationsPhase.mockImplementation(async (params: any) => {
      if (params.hook === "before_main_llm") {
        params.onOperationFinished?.({
          hook: "before_main_llm",
          opId: "op-activation-skip",
          name: "Activation skip op",
          status: "skipped",
          skipReason: "activation_not_reached",
          skipDetails: {
            activation: {
              everyNTurns: 5,
              turnsCounter: 2,
              tokensCounter: 500,
            },
          },
        });
        return [
          {
            opId: "op-activation-skip",
            name: "Activation skip op",
            required: false,
            hook: "before_main_llm",
            status: "skipped",
            skipReason: "activation_not_reached",
            skipDetails: {
              activation: {
                everyNTurns: 5,
                turnsCounter: 2,
                tokensCounter: 500,
              },
            },
            order: 10,
            dependsOn: [],
            effects: [],
          },
        ];
      }
      return [];
    });
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    const events: any[] = [];
    for await (const evt of runChatGenerationV3(makeRequest())) {
      events.push(evt);
    }

    const finished = events.find(
      (evt) => evt.type === "operation.finished" && evt.data?.opId === "op-activation-skip"
    );
    expect(finished?.data?.status).toBe("skipped");
    expect(finished?.data?.skipReason).toBe("activation_not_reached");
    expect(finished?.data?.skipDetails?.activation).toMatchObject({
      everyNTurns: 5,
      turnsCounter: 2,
      tokensCounter: 500,
    });
  });

  test("emits assistant canonicalization after a successful rewrite commit", async () => {
    mocks.executeOperationsPhase.mockResolvedValue([]);
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => {
      if (params.hook === "after_main_llm") {
        params.onAssistantTurnCanonicalized?.({
          hook: "after_main_llm",
          opId: "assistant-rewrite",
          assistantEntryId: "assistant-entry",
          assistantMainPartId: "assistant-main-part",
          beforeText: "raw",
          afterText: "normalized",
          committedAt: "2026-07-13T00:00:00.000Z",
        });
      }
      return {
        report: { hook: params.hook, status: "done", effects: [] },
        requiredError: false,
      };
    });
    mocks.runMainLlmPhase.mockImplementation(async ({ runState }: any) => {
      runState.assistantText = "raw";
      return { status: "done" };
    });

    const events: any[] = [];
    for await (const event of runChatGenerationV3(makeRequest())) {
      events.push(event);
    }

    expect(events).toContainEqual(
      expect.objectContaining({
        type: "turn.assistant.canonicalized",
        data: expect.objectContaining({
          assistantEntryId: "assistant-entry",
          assistantMainPartId: "assistant-main-part",
          afterText: "normalized",
        }),
      })
    );
  });

  test("streams main_llm.reasoning_delta while main phase is running", async () => {
    const mainGate = deferred<void>();
    mocks.executeOperationsPhase.mockResolvedValue([]);
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockImplementation(async ({ onReasoningDelta }: any) => {
      onReasoningDelta("thinking");
      await mainGate.promise;
      return { status: "done" };
    });

    const events: any[] = [];
    let resolveReasoningSeen!: () => void;
    const reasoningSeen = new Promise<void>((resolve) => {
      resolveReasoningSeen = resolve;
    });

    const consume = (async () => {
      for await (const evt of runChatGenerationV3(makeRequest())) {
        events.push(evt);
        if (evt.type === "main_llm.reasoning_delta") resolveReasoningSeen();
      }
    })();

    await Promise.race([
      reasoningSeen,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timed out waiting for main_llm.reasoning_delta")), 500)
      ),
    ]);

    expect(events.some((evt) => evt.type === "main_llm.reasoning_delta")).toBe(true);

    mainGate.resolve();
    await consume;
  });

  test("merges instruction derived settings with request settings for main LLM", async () => {
    const request = makeRequest();
    request.settings = {
      top_p: 0.91,
      temperature: 0.95,
    };
    mocks.buildBasePrompt.mockResolvedValueOnce({
      prompt: {
        systemPrompt: "sys",
        historyReturnedCount: 1,
        promptHash: "h",
        promptSnapshot: {
          v: 1,
          messages: [],
          truncated: false,
          meta: { historyLimit: 50, historyReturnedCount: 1 },
        },
        llmMessages: [{ role: "system", content: "sys" }],
        draftMessages: [{ role: "system", content: "sys" }],
      },
      templateContext: {
        char: {},
        user: {},
        chat: {},
        messages: [],
        rag: {},
        art: {},
        now: new Date().toISOString(),
      },
      worldInfoDiagnostics: {
        worldInfoBefore: "",
        worldInfoAfter: "",
        depthEntries: [],
        outletEntries: {},
        anTop: [],
        anBottom: [],
        emTop: [],
        emBottom: [],
        warnings: [],
        activatedCount: 0,
        activatedEntries: [],
      },
      instructionDerivedSettings: {
        temperature: 0.4,
        maxTokens: 321,
      },
    });
    mocks.executeOperationsPhase.mockResolvedValue([]);
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    for await (const _evt of runChatGenerationV3(request)) {
      // consume
    }

    const call = mocks.runMainLlmPhase.mock.calls[0]?.[0];
    expect(call.request.settings).toEqual({
      temperature: 0.95,
      maxTokens: 321,
      top_p: 0.91,
    });
  });

  test("emits normalizedLlmMessages in run.debug.main_llm_input", async () => {
    const request = makeRequest();
    request.settings = {
      __chatGenerationDebug: true,
    };
    mocks.buildBasePrompt.mockResolvedValueOnce({
      prompt: {
        systemPrompt: "sys-1",
        historyReturnedCount: 1,
        promptHash: "h",
        promptSnapshot: {
          v: 1,
          messages: [],
          truncated: false,
          meta: { historyLimit: 50, historyReturnedCount: 1 },
        },
        llmMessages: [
          { role: "system", content: "sys-1" },
          { role: "system", content: "sys-2" },
          { role: "user", content: "hello" },
        ],
        draftMessages: [
          { role: "system", content: "sys-1" },
          { role: "system", content: "sys-2" },
          { role: "user", content: "hello" },
        ],
      },
      templateContext: {
        char: {},
        user: {},
        chat: {},
        messages: [],
        rag: {},
        art: {},
        now: new Date().toISOString(),
      },
      worldInfoDiagnostics: {
        worldInfoBefore: "",
        worldInfoAfter: "",
        depthEntries: [],
        outletEntries: {},
        anTop: [],
        anBottom: [],
        emTop: [],
        emBottom: [],
        warnings: [],
        activatedCount: 0,
        activatedEntries: [],
      },
      instructionDerivedSettings: {},
    });
    mocks.executeOperationsPhase.mockResolvedValue([]);
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    const events: any[] = [];
    for await (const evt of runChatGenerationV3(request)) {
      events.push(evt);
    }

    const debugEvent = events.find((evt) => evt.type === "run.debug.main_llm_input");
    expect(debugEvent).toBeTruthy();
    expect(debugEvent.data.llmMessages).toEqual([
      { role: "system", content: "sys-1" },
      { role: "system", content: "sys-2" },
      { role: "user", content: "hello" },
    ]);
    expect(debugEvent.data.normalizedLlmMessages).toEqual([
      { role: "system", content: "sys-1\n\nsys-2" },
      { role: "user", content: "hello" },
    ]);
  });

  test("persists updated operation activation counters into chat runtime state", async () => {
    mocks.resolveRunContext.mockResolvedValueOnce({
      context: {
        ownerId: "global",
        runId: "gen-1",
        generationId: "gen-1",
        trigger: "generate",
        chatId: "chat-1",
        branchId: "branch-1",
        entityProfileId: "entity-1",
        profileSnapshot: {
          profileId: "profile-1",
          version: 1,
          executionMode: "sequential",
          operationProfileSessionId: "sess-1",
          operations: [
            {
              opId: "op-1",
              name: "Op 1",
              kind: "template",
              config: {
                enabled: true,
                required: false,
                hooks: ["before_main_llm"],
                triggers: ["generate"],
                activation: { everyNTurns: 5, everyNContextTokens: 100 },
                order: 1,
                params: {
                  template: "x",
                  output: {
                    type: "artifacts",
                    writeArtifact: {
                      tag: "a",
                      persistence: "run_only",
                      usage: "internal",
                      semantics: "intermediate",
                    },
                  },
                },
              },
            },
          ],
        },
        runtimeInfo: { providerId: "openrouter", model: "m" },
        sessionKey: "k",
        historyLimit: 50,
        startedAt: Date.now(),
      },
      profile: null,
    });
    mocks.loadOrBootstrapRuntimeState.mockResolvedValueOnce({
      payload: {
        version: 1,
        activationByOpId: {
          "op-1": { turnsCounter: 2, tokensCounter: 7 },
        },
        bootstrap: {
          source: "branch_active_history",
          userEventsCount: 2,
          lastRebuiltAt: "2026-02-01T00:00:00.000Z",
        },
      },
      updatedAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    mocks.executeOperationsPhase.mockResolvedValue([]);
    mocks.commitEffectsPhase.mockImplementation(async (params: any) => ({
      report: { hook: params.hook, status: "done", effects: [] },
      requiredError: false,
    }));
    mocks.runMainLlmPhase.mockResolvedValue({ status: "done" });

    for await (const _evt of runChatGenerationV3(makeRequest())) {
      // consume
    }

    const upsertPayload = mocks.chatRuntimeStateUpsert.mock.calls[0]?.[0]?.payload;
    expect(upsertPayload.activationByOpId["op-1"]).toEqual({
      turnsCounter: 3,
      tokensCounter: 7,
    });
  });
});
