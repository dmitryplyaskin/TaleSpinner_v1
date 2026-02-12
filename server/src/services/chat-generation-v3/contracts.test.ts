import { describe, expect, test } from "vitest";

import { mapOperationOutputToEffectType } from "./contracts";

describe("mapOperationOutputToEffectType", () => {
  test("maps artifacts output", () => {
    expect(
      mapOperationOutputToEffectType({
        type: "artifacts",
        writeArtifact: {
          tag: "x",
          persistence: "run_only",
          usage: "internal",
          semantics: "intermediate",
        },
      })
    ).toBe("artifact.upsert");
  });

  test("maps turn canonicalization output for both targets", () => {
    expect(
      mapOperationOutputToEffectType({
        type: "turn_canonicalization",
        canonicalization: {
          kind: "replace_text",
          target: "assistant",
        },
      })
    ).toBe("turn.assistant.replace_text");

    expect(
      mapOperationOutputToEffectType({
        type: "turn_canonicalization",
        canonicalization: {
          kind: "replace_text",
          target: "user",
        },
      })
    ).toBe("turn.user.replace_text");
  });

  test("maps prompt_time output kinds", () => {
    expect(
      mapOperationOutputToEffectType({
        type: "prompt_time",
        promptTime: {
          kind: "system_update",
          mode: "append",
        },
      })
    ).toBe("prompt.system_update");

    expect(
      mapOperationOutputToEffectType({
        type: "prompt_time",
        promptTime: {
          kind: "append_after_last_user",
          role: "system",
        },
      })
    ).toBe("prompt.append_after_last_user");

    expect(
      mapOperationOutputToEffectType({
        type: "prompt_time",
        promptTime: {
          kind: "insert_at_depth",
          depthFromEnd: 1,
          role: "assistant",
        },
      })
    ).toBe("prompt.insert_at_depth");
  });
});
