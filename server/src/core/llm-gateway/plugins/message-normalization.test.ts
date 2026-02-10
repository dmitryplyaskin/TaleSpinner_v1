import { describe, expect, test } from "vitest";

import { messageNormalizationPlugin } from "./message-normalization";

describe("messageNormalizationPlugin", () => {
  test("match requires explicit feature enabled=true", () => {
    expect(
      messageNormalizationPlugin.match?.({
        providerId: "openrouter",
        model: "m",
        features: {},
      })
    ).toBe(false);

    expect(
      messageNormalizationPlugin.match?.({
        providerId: "openrouter",
        model: "m",
        features: { messageNormalization: { enabled: true } },
      })
    ).toBe(true);
  });

  test("merges multiple system messages and consecutive assistant messages", () => {
    const out = messageNormalizationPlugin.normalizeMessages!(
      {
        providerId: "openrouter",
        model: "m",
        messages: [
          { role: "system", content: "s1" },
          { role: "user", content: "u1" },
          { role: "system", content: "s2" },
          { role: "assistant", content: "a1" },
          { role: "assistant", content: "a2" },
        ],
        sampling: {},
        extra: {},
        headers: {},
        payload: {},
        features: { messageNormalization: { enabled: true } },
        logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
      },
      { enabled: true }
    );

    expect(out.messages).toEqual([
      { role: "system", content: "s1\n\ns2" },
      { role: "user", content: "u1" },
      { role: "assistant", content: "a1\n\na2" },
    ]);
    expect(out.warnings).toEqual([
      "Merged multiple system messages into one",
      "Merged consecutive assistant messages",
    ]);
  });

  test("supports disabling specific merges and custom separator", () => {
    const out = messageNormalizationPlugin.normalizeMessages!(
      {
        providerId: "openrouter",
        model: "m",
        messages: [
          { role: "system", content: "s1" },
          { role: "system", content: "s2" },
          { role: "assistant", content: "a1" },
          { role: "assistant", content: "a2" },
        ],
        sampling: {},
        extra: {},
        headers: {},
        payload: {},
        features: { messageNormalization: { enabled: true } },
        logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
      },
      { enabled: true, mergeSystem: false, mergeConsecutiveAssistant: true, separator: " | " }
    );

    expect(out.messages).toEqual([
      { role: "system", content: "s1" },
      { role: "system", content: "s2" },
      { role: "assistant", content: "a1 | a2" },
    ]);
    expect(out.warnings).toEqual(["Merged consecutive assistant messages"]);
  });

  test("returns unchanged messages when feature disabled", () => {
    const input = [{ role: "user" as const, content: "x" }];
    const out = messageNormalizationPlugin.normalizeMessages!(
      {
        providerId: "openrouter",
        model: "m",
        messages: input,
        sampling: {},
        extra: {},
        headers: {},
        payload: {},
        features: {},
        logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
      },
      { enabled: false }
    );

    expect(out).toEqual({ messages: input });
  });
});
