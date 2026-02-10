import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  updateGenerationRunReports: vi.fn(),
  finishGeneration: vi.fn(),
}));

vi.mock("../../chat-core/generations-repository", () => ({
  updateGenerationRunReports: mocks.updateGenerationRunReports,
  finishGeneration: mocks.finishGeneration,
}));

import { finalizeRun } from "./finalize-run";
import type { RunContext, RunResult } from "../contracts";

function makeContext(): RunContext {
  return {
    ownerId: "global",
    runId: "gen-1",
    generationId: "gen-1",
    trigger: "generate",
    chatId: "chat-1",
    branchId: "branch-1",
    entityProfileId: "entity-1",
    profileSnapshot: null,
    runtimeInfo: {
      providerId: "openrouter",
      model: "m",
    },
    sessionKey: null,
    historyLimit: 50,
    startedAt: 1_700_000_000_000,
  };
}

function makeResult(status: RunResult["status"], errorMessage: string | null = null): RunResult {
  return {
    runId: "gen-1",
    generationId: "gen-1",
    status,
    failedType: status === "failed" ? "before_barrier" : null,
    phaseReports: [
      {
        phase: "prepare_run_context",
        status: "done",
        startedAt: 1,
        finishedAt: 2,
      },
    ],
    commitReportsByHook: {
      before_main_llm: {
        hook: "before_main_llm",
        status: "done",
        effects: [],
      },
    },
    promptHash: null,
    promptSnapshot: null,
    assistantText: "",
    errorMessage,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.updateGenerationRunReports.mockResolvedValue(undefined);
  mocks.finishGeneration.mockResolvedValue(undefined);
});

describe("finalizeRun", () => {
  test("writes run reports and finishes generation with done status", async () => {
    const context = makeContext();
    const result = makeResult("done");

    await finalizeRun({ context, result });

    expect(mocks.updateGenerationRunReports).toHaveBeenCalledWith({
      id: "gen-1",
      phaseReport: result.phaseReports,
      commitReport: result.commitReportsByHook,
    });
    expect(mocks.finishGeneration).toHaveBeenCalledWith({
      id: "gen-1",
      status: "done",
      error: null,
    });
  });

  test("maps aborted run status to aborted generation status", async () => {
    await finalizeRun({
      context: makeContext(),
      result: makeResult("aborted"),
    });

    expect(mocks.finishGeneration).toHaveBeenCalledWith({
      id: "gen-1",
      status: "aborted",
      error: null,
    });
  });

  test("maps failed run status to error generation status and forwards error", async () => {
    await finalizeRun({
      context: makeContext(),
      result: makeResult("failed", "before barrier failed"),
    });

    expect(mocks.finishGeneration).toHaveBeenCalledWith({
      id: "gen-1",
      status: "error",
      error: "before barrier failed",
    });
  });

  test("maps error run status to error generation status and forwards error", async () => {
    await finalizeRun({
      context: makeContext(),
      result: makeResult("error", "unexpected"),
    });

    expect(mocks.finishGeneration).toHaveBeenCalledWith({
      id: "gen-1",
      status: "error",
      error: "unexpected",
    });
  });
});
