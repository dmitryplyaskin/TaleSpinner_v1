import { describe, expect, test } from "vitest";

import {
  createStAdvancedConfigFromPreset,
  detectStChatCompletionPreset,
  resolveStAdvancedInstructionRuntime,
  stripSensitiveFieldsFromPreset,
} from "./instruction-st-preset";

describe("instruction-st-preset", () => {
  test("parses ST Default.json compatible preset shape", () => {
    const rawDefault = `{
      "chat_completion_source": "openai",
      "openai_model": "gpt-4-turbo",
      "temperature": 1,
      "top_p": 1,
      "openai_max_tokens": 300,
      "stream_openai": true,
      "prompts": [
        { "identifier": "main", "name": "Main Prompt", "role": "system", "content": "Write {{char}}", "system_prompt": true },
        { "identifier": "chatHistory", "name": "Chat History", "system_prompt": true },
        { "identifier": "jailbreak", "name": "Post-History Instructions", "role": "system", "content": "", "system_prompt": true }
      ],
      "prompt_order": [
        {
          "character_id": 100001,
          "order": [
            { "identifier": "main", "enabled": true },
            { "identifier": "chatHistory", "enabled": true },
            { "identifier": "jailbreak", "enabled": true }
          ]
        }
      ],
      "extensions": {}
    }`;

    const parsed = JSON.parse(rawDefault) as Record<string, unknown>;
    expect(detectStChatCompletionPreset(parsed)).toBe(true);

    const normalized = createStAdvancedConfigFromPreset({
      preset: parsed,
      fileName: "Default.json",
      sensitiveImportMode: "keep",
    });

    expect(normalized.prompts.length).toBe(3);
    expect(normalized.promptOrder.length).toBe(1);
    expect(normalized.responseConfig).toMatchObject({
      temperature: 1,
      top_p: 1,
      openai_max_tokens: 300,
      stream_openai: true,
    });
    expect(
      Object.prototype.hasOwnProperty.call(normalized.responseConfig, "openai_model")
    ).toBe(false);
  });

  test("detects ST chat completion preset shape", () => {
    expect(
      detectStChatCompletionPreset({
        chat_completion_source: "openai",
        openai_model: "gpt-4-turbo",
      })
    ).toBe(true);

    expect(
      detectStChatCompletionPreset({
        type: "talespinner.instruction",
      })
    ).toBe(false);
  });

  test("strips sensitive fields", () => {
    const input = {
      custom_url: "https://proxy.local/v1",
      reverse_proxy: "https://proxy.local",
      temperature: 0.8,
    };

    const output = stripSensitiveFieldsFromPreset(input);
    expect(output.temperature).toBe(0.8);
    expect(Object.prototype.hasOwnProperty.call(output, "custom_url")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(output, "reverse_proxy")).toBe(false);
  });

  test("normalizes preset with sensitive mode and extracts response config", () => {
    const preset = {
      chat_completion_source: "openai",
      temperature: 0.8,
      top_p: 0.9,
      openai_max_tokens: 512,
      openai_model: "gpt-4-turbo",
      custom_url: "https://proxy.local/v1",
      prompts: [],
      prompt_order: [],
    };

    const removed = createStAdvancedConfigFromPreset({
      preset,
      fileName: "Default.json",
      sensitiveImportMode: "remove",
    });
    expect(removed.importInfo.fileName).toBe("Default.json");
    expect(Object.prototype.hasOwnProperty.call(removed.rawPreset, "custom_url")).toBe(false);
    expect(removed.responseConfig.temperature).toBe(0.8);
    expect(removed.responseConfig.top_p).toBe(0.9);
    expect(removed.responseConfig.openai_max_tokens).toBe(512);
    expect(
      Object.prototype.hasOwnProperty.call(removed.responseConfig, "openai_model")
    ).toBe(false);

    const kept = createStAdvancedConfigFromPreset({
      preset,
      fileName: "Default.json",
      sensitiveImportMode: "keep",
    });
    expect(kept.rawPreset.custom_url).toBe("https://proxy.local/v1");
  });

  test("uses prompt_order with preferred character id and splits pre/post history prompts", async () => {
    const stAdvanced = createStAdvancedConfigFromPreset({
      preset: {
        prompts: [
          {
            identifier: "main",
            role: "system",
            content: "Main {{char.name}}",
          },
          {
            identifier: "worldInfoBefore",
            role: "system",
            content: "",
          },
          {
            identifier: "jailbreak",
            role: "system",
            content: "Post {{user.name}}",
          },
        ],
        prompt_order: [
          {
            character_id: 100000,
            order: [
              { identifier: "main", enabled: false },
              { identifier: "jailbreak", enabled: true },
            ],
          },
          {
            character_id: 100001,
            order: [
              { identifier: "main", enabled: true },
              { identifier: "worldInfoBefore", enabled: true },
              { identifier: "chatHistory", enabled: true },
              { identifier: "jailbreak", enabled: true },
            ],
          },
        ],
        temperature: 0.65,
        openai_max_tokens: 333,
      },
      fileName: "Default.json",
      sensitiveImportMode: "keep",
    });

    const resolved = await resolveStAdvancedInstructionRuntime({
      stAdvanced,
      context: {
        char: { name: "Lilly" },
        user: { name: "Dima" },
        chat: {},
        messages: [],
        rag: {},
        art: {},
        now: new Date("2026-02-13T00:00:00.000Z").toISOString(),
        wiBefore: "WI BEFORE",
      },
    });

    expect(resolved.systemPrompt).toBe("Main Lilly");
    expect(resolved.preHistorySystemMessages).toEqual(["WI BEFORE"]);
    expect(resolved.postHistorySystemMessages).toEqual(["Post Dima"]);
    expect(resolved.derivedSettings).toMatchObject({
      temperature: 0.65,
      maxTokens: 333,
    });
    expect(resolved.usedPromptIdentifiers).toEqual([
      "main",
      "worldInfoBefore",
      "chatHistory",
      "jailbreak",
    ]);
  });
});
