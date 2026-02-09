import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveRunContext: vi.fn(),
  buildBasePrompt: vi.fn(),
  executeOperationsPhase: vi.fn(),
  commitEffectsPhase: vi.fn(),
  runMainLlmPhase: vi.fn(),
  finalizeRun: vi.fn(),
  updateGenerationPromptData: vi.fn(),
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
});
