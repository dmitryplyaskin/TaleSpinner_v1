import { describe, expect, test } from "vitest";

import type { OperationProfile } from "@shared/types/operation-profiles";

import {
  applyTemplateOperationsAfterMainLlm,
  applyTemplateOperationsToPromptDraft,
} from "./template-operations-runtime";

function makeProfile(operations: OperationProfile["operations"]): OperationProfile {
  const now = new Date();
  return {
    profileId: "8d31b79e-7e57-4dc8-bf1f-2c2518dfe327",
    ownerId: "global",
    name: "p",
    enabled: true,
    executionMode: "sequential",
    operationProfileSessionId: "0f0e6f22-7780-4cf6-8c00-31d0f4f96217",
    version: 1,
    operations,
    meta: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("template operations runtime", () => {
  test("applies before_main_llm prompt_time system_update", async () => {
    const profile = makeProfile([
      {
        opId: "a7ea76de-6e0a-4f8a-a9fb-6eb9ad33c7df",
        name: "sys prepend",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["before_main_llm"],
          triggers: ["generate"],
          order: 10,
          params: {
            template: "[{{user.name}}]",
            output: {
              type: "prompt_time",
              promptTime: { kind: "system_update", mode: "prepend", source: "t" },
            },
          },
        },
      },
    ]);

    const out = await applyTemplateOperationsToPromptDraft({
      runId: "run-1",
      profile,
      trigger: "generate",
      draftMessages: [
        { role: "system", content: "base" },
        { role: "user", content: "hello" },
      ],
      templateContext: {
        char: {},
        user: { name: "U" },
        chat: {},
        messages: [],
        rag: {},
        art: {},
        now: new Date().toISOString(),
      },
    });

    expect(out.messages[0]).toEqual({ role: "system", content: "[U]base" });
  });

  test("applies after_main_llm assistant canonicalization replace_text", async () => {
    const profile = makeProfile([
      {
        opId: "de11b614-a56e-4d95-9ee3-5a4ffb0b2d44",
        name: "assistant post",
        kind: "template",
        config: {
          enabled: true,
          required: false,
          hooks: ["after_main_llm"],
          triggers: ["generate", "regenerate"],
          order: 10,
          params: {
            template: "normalized",
            output: {
              type: "turn_canonicalization",
              canonicalization: { kind: "replace_text", target: "assistant" },
            },
          },
        },
      },
    ]);

    const out = await applyTemplateOperationsAfterMainLlm({
      runId: "run-2",
      profile,
      trigger: "generate",
      draftMessages: [{ role: "user", content: "hello" }],
      assistantText: "raw",
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

    expect(out.assistantText).toBe("normalized");
  });
});
