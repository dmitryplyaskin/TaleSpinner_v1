import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRunContext: vi.fn(),
  buildBasePrompt: vi.fn(),
  executeOperationsPhase: vi.fn(),
  commitEffectsPhase: vi.fn(),
  runMainLlmPhase: vi.fn(),
  finalizeRun: vi.fn(),
  updateGenerationPromptData: vi.fn(),
  updateGenerationDebugJson: vi.fn(),
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

vi.mock("./persist/finalize-run", () => ({
  finalizeRun: mocks.finalizeRun,
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
    load: vi.fn(async () => ({})),
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
  });
});

describe("runChatGenerationV3", () => {
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
});
