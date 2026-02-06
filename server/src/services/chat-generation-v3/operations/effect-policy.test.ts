import { describe, expect, test } from "vitest";

import { validateEffectForHook } from "./effect-policy";

describe("effect policy", () => {
  test("forbids prompt effects in after_main_llm", () => {
    const result = validateEffectForHook({
      hook: "after_main_llm",
      effect: {
        type: "prompt.system_update",
        opId: "op",
        mode: "append",
        payload: "x",
      },
    });
    expect(result.ok).toBe(false);
  });

  test("forbids assistant turn effects in before_main_llm", () => {
    const result = validateEffectForHook({
      hook: "before_main_llm",
      effect: {
        type: "turn.assistant.replace_text",
        opId: "op",
        text: "x",
      },
    });
    expect(result.ok).toBe(false);
  });

  test("allows artifact effects in both hooks", () => {
    const before = validateEffectForHook({
      hook: "before_main_llm",
      effect: {
        type: "artifact.upsert",
        opId: "op",
        tag: "x",
        persistence: "run_only",
        usage: "internal",
        semantics: "intermediate",
        value: "v",
      },
    });
    const after = validateEffectForHook({
      hook: "after_main_llm",
      effect: {
        type: "artifact.upsert",
        opId: "op",
        tag: "x",
        persistence: "run_only",
        usage: "internal",
        semantics: "intermediate",
        value: "v",
      },
    });
    expect(before.ok).toBe(true);
    expect(after.ok).toBe(true);
  });
});
