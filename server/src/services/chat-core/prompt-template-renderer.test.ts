import { describe, expect, test } from "vitest";

import { renderLiquidTemplate, validateLiquidTemplate } from "./prompt-template-renderer";

function makeContext() {
  return {
    char: {},
    user: { name: "Alice", nested: "{{ user.name }}-N" },
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  };
}

describe("prompt-template-renderer", () => {
  test("validateLiquidTemplate accepts valid templates and rejects invalid", () => {
    expect(() => validateLiquidTemplate("Hello {{ user.name }}")).not.toThrow();
    expect(() => validateLiquidTemplate("{{ broken ")).toThrow();
  });

  test("renders regular template values", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "Hi {{ user.name }}",
      context: makeContext(),
    });

    expect(rendered).toBe("Hi Alice");
  });

  test("supports multi-pass nested rendering", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "{{ user.nested }}",
      context: makeContext(),
      options: { maxPasses: 5 },
    });

    expect(rendered).toBe("Alice-N");
  });

  test("honors maxPasses and can stop before nested value resolves", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "{{ user.nested }}",
      context: makeContext(),
      options: { maxPasses: 1 },
    });

    expect(rendered).toBe("{{ user.name }}-N");
  });

  test("throws on missing variables when strictVariables enabled", async () => {
    await expect(
      renderLiquidTemplate({
        templateText: "{{ missing.value }}",
        context: makeContext(),
        options: { strictVariables: true },
      })
    ).rejects.toThrow();
  });

  test("returns previous output when extra pass parsing fails", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "{{ '{{ broken ' }}",
      context: makeContext(),
      options: { maxPasses: 5 },
    });

    expect(rendered).toBe("{{ broken ");
  });
});
