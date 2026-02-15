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
    outlet: {
      default: "OUTLET_TEXT",
    },
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  };
}

describe("prompt-template-renderer", () => {
  test("validateLiquidTemplate accepts valid templates and rejects invalid", () => {
    expect(() => validateLiquidTemplate("Hello {{ user.name }}")).not.toThrow();
    expect(() => validateLiquidTemplate("{{outlet::default}}")).not.toThrow();
    expect(() => validateLiquidTemplate("{{random::A::B}}")).not.toThrow();
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

  test("supports ST outlet macro syntax", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "X={{outlet::default}}",
      context: makeContext(),
    });

    expect(rendered).toBe("X=OUTLET_TEXT");
  });

  test("trim macro removes surrounding blank lines between WI blocks", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "Start\n\n{{ wiBefore }}\n{{ trim }}\n\n{{ wiAfter }}\n\nEnd",
      context: {
        ...makeContext(),
        wiBefore: "BEFORE",
        wiAfter: "AFTER",
      },
    });

    expect(rendered).toBe("Start\n\nBEFORE\nAFTER\n\nEnd");
  });

  test("strictVariables mode works with trim macro", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "A\n{{trim}}\nB",
      context: makeContext(),
      options: { strictVariables: true },
    });

    expect(rendered).toBe("A\nB");
  });

  test("supports ST random macro syntax with deterministic rng", async () => {
    const first = await renderLiquidTemplate({
      templateText: "Pick={{random::A::B::C}}",
      context: makeContext(),
      options: { rng: () => 0 },
    });
    const last = await renderLiquidTemplate({
      templateText: "Pick={{random::A::B::C}}",
      context: makeContext(),
      options: { rng: () => 0.999999 },
    });

    expect(first).toBe("Pick=A");
    expect(last).toBe("Pick=C");
  });

  test("exposes lastUserMessage and lastAssistantMessage aliases from messages", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "U={{lastUserMessage}} | A={{lastAssistantMessage}}",
      context: {
        ...makeContext(),
        messages: [
          { role: "system", content: "S0" },
          { role: "assistant", content: "A1" },
          { role: "user", content: "U1" },
          { role: "assistant", content: "A2" },
          { role: "user", content: "U2" },
        ],
      },
    });

    expect(rendered).toBe("U=U2 | A=A2");
  });

  test("lastAssistantMessage points to fresh assistant text when it is in messages tail", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "{{lastAssistantMessage}}",
      context: {
        ...makeContext(),
        messages: [
          { role: "assistant", content: "old answer" },
          { role: "user", content: "new question" },
          { role: "assistant", content: "fresh main llm answer" },
        ],
      },
    });

    expect(rendered).toBe("fresh main llm answer");
  });

  test("keeps malformed random macro as literal without throwing", async () => {
    const rendered = await renderLiquidTemplate({
      templateText: "Bad={{random::   }}",
      context: makeContext(),
    });

    expect(rendered).toBe("Bad={{random::   }}");
  });
});
