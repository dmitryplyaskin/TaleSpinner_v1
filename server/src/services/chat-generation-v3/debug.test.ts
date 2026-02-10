import { describe, expect, test } from "vitest";

import {
  CHAT_GENERATION_DEBUG_SETTING_KEY,
  isChatGenerationDebugEnabled,
  stripChatGenerationDebugSettings,
} from "./debug";

describe("chat-generation debug helpers", () => {
  test("detects enabled debug setting from boolean and string values", () => {
    expect(isChatGenerationDebugEnabled(undefined)).toBe(false);
    expect(isChatGenerationDebugEnabled({})).toBe(false);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: true })).toBe(true);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: "1" })).toBe(true);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: "true" })).toBe(true);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: "yes" })).toBe(true);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: "on" })).toBe(true);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: "  ON  " })).toBe(true);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: "false" })).toBe(false);
    expect(isChatGenerationDebugEnabled({ [CHAT_GENERATION_DEBUG_SETTING_KEY]: 1 })).toBe(false);
  });

  test("strips debug setting key and keeps others intact", () => {
    const input = {
      [CHAT_GENERATION_DEBUG_SETTING_KEY]: "true",
      model: "x",
      temperature: 0.7,
    } as Record<string, unknown>;

    const out = stripChatGenerationDebugSettings(input);

    expect(out).toEqual({
      model: "x",
      temperature: 0.7,
    });
    expect(input[CHAT_GENERATION_DEBUG_SETTING_KEY]).toBe("true");
  });

  test("returns empty object for undefined settings in strip helper", () => {
    expect(stripChatGenerationDebugSettings(undefined)).toEqual({});
  });
});
