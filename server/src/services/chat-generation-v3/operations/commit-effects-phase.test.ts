import { describe, expect, test } from "vitest";

import { RunArtifactStore } from "../artifacts/run-artifact-store";
import type { RunState } from "../contracts";
import { commitEffectsPhase } from "./commit-effects-phase";

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

describe("commit effects phase", () => {
  test("commits in deterministic dependency-first order", async () => {
    const state = makeRunState();
    state.operationResultsByHook.before_main_llm = [
      {
        opId: "b",
        name: "B",
        required: false,
        hook: "before_main_llm",
        status: "done",
        order: 10,
        dependsOn: ["a"],
        effects: [
          {
            type: "prompt.append_after_last_user",
            opId: "b",
            role: "developer",
            payload: "B",
          },
        ],
      },
      {
        opId: "a",
        name: "A",
        required: false,
        hook: "before_main_llm",
        status: "done",
        order: 30,
        dependsOn: [],
        effects: [
          {
            type: "prompt.append_after_last_user",
            opId: "a",
            role: "developer",
            payload: "A",
          },
        ],
      },
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

  test("fails required user canonicalization when target is missing", async () => {
    const state = makeRunState();
    state.operationResultsByHook.after_main_llm = [
      {
        opId: "u",
        name: "U",
        required: true,
        hook: "after_main_llm",
        status: "done",
        order: 10,
        dependsOn: [],
        effects: [{ type: "turn.user.replace_text", opId: "u", text: "normalized" }],
      },
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
      userTurnTarget: undefined,
    });

    expect(result.requiredError).toBe(true);
    expect(result.report.status).toBe("error");
  });
});
