import { describe, expect, test, vi } from "vitest";

import { runMainLlmPhase } from "./run-main-llm-phase";
import { streamGlobalChat } from "../../llm/llm-service";

import type { RunRequest, RunState } from "../contracts";

vi.mock("../../llm/llm-service", () => ({
  streamGlobalChat: vi.fn(),
}));

vi.mock("../../chat-entry-parts/parts-repository", () => ({
  updatePartPayloadText: vi.fn().mockResolvedValue(undefined),
}));

function makeRequest(abortController: AbortController): RunRequest {
  return {
    ownerId: "global",
    chatId: "chat-1",
    branchId: "branch-1",
    entityProfileId: "profile-1",
    trigger: "regenerate",
    settings: {},
    abortController,
    persistenceTarget: {
      mode: "entry_parts",
      assistantEntryId: "assistant-entry-1",
      assistantMainPartId: "assistant-main-part-1",
      assistantReasoningPartId: "assistant-reasoning-part-1",
    },
  };
}

function makeRunState(): RunState {
  return {
    basePromptDraft: [],
    effectivePromptDraft: [],
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

describe("runMainLlmPhase", () => {
  test("returns aborted when stream closes after abort before first token", async () => {
    const abortController = new AbortController();

    async function* abortedStream() {
      abortController.abort();
      yield* [] as Array<{ content: string; reasoning: string; error: null }>;
      return;
    }

    vi.mocked(streamGlobalChat).mockReturnValue(abortedStream() as any);

    const result = await runMainLlmPhase({
      request: makeRequest(abortController),
      runState: makeRunState(),
      ownerId: "global",
      abortController,
      onDelta: () => undefined,
      onReasoningDelta: () => undefined,
    });

    expect(result.status).toBe("aborted");
  });
});
