import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSelectedUserPerson: vi.fn(),
  getEntityProfileById: vi.fn(),
  getChatById: vi.fn(),
  listProjectedPromptMessages: vi.fn(),
  resolveWorldInfoRuntimeForChat: vi.fn(),
  renderLiquidTemplate: vi.fn(),
}));

vi.mock("./user-persons-repository", () => ({
  getSelectedUserPerson: mocks.getSelectedUserPerson,
}));
vi.mock("./entity-profiles-repository", () => ({
  getEntityProfileById: mocks.getEntityProfileById,
}));
vi.mock("./chats-repository", () => ({
  getChatById: mocks.getChatById,
}));
vi.mock("../chat-entry-parts/prompt-history", () => ({
  listProjectedPromptMessages: mocks.listProjectedPromptMessages,
}));
vi.mock("../world-info/world-info-runtime", () => ({
  resolveWorldInfoRuntimeForChat: mocks.resolveWorldInfoRuntimeForChat,
}));
vi.mock("./prompt-template-renderer", () => ({
  renderLiquidTemplate: mocks.renderLiquidTemplate,
}));

import {
  applyWorldInfoToTemplateContext,
  buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext,
} from "./prompt-template-context";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSelectedUserPerson.mockResolvedValue(null);
  mocks.getEntityProfileById.mockResolvedValue(null);
  mocks.getChatById.mockResolvedValue(null);
  mocks.listProjectedPromptMessages.mockResolvedValue({ currentTurn: 0, entryCount: 0, messages: [] });
  mocks.resolveWorldInfoRuntimeForChat.mockResolvedValue(null);
  mocks.renderLiquidTemplate.mockImplementation(
    async ({ templateText, context }: { templateText: string; context: { char?: unknown } }) =>
      templateText.replace(/{{char}}/g, String(context.char ?? ""))
  );
});

describe("prompt-template-context", () => {
  test("uses contentTypeDefault as persona alias with prefix fallback", async () => {
    mocks.getSelectedUserPerson.mockResolvedValue({
      id: "u-1",
      name: "Alice",
      prefix: "Prefix fallback",
      contentTypeDefault: "Persona description",
    });
    mocks.getEntityProfileById.mockResolvedValue({
      id: "c-1",
      spec: {
        name: "Lilly",
        description: "desc",
        personality: "kind",
        scenario: "ship",
        system_prompt: "system",
        mes_example: "example",
      },
    });

    const context = await buildPromptTemplateRenderContext({
      ownerId: "global",
      entityProfileId: "c-1",
    });

    expect(context.persona).toBe("Persona description");
    expect(context.description).toBe("desc");
    expect(context.personality).toBe("kind");
    expect(context.scenario).toBe("ship");
    expect(context.system).toBe("system");
    expect(context.mesExamplesRaw).toBe("example");
    expect(context.mesExamples).toBe("example");
    expect(String(context.user)).toBe("Alice");
    expect(String(context.char)).toBe("Lilly");
    expect(context.wiBefore).toBe("");
    expect(context.wiAfter).toBe("");
    expect(context.outlet).toEqual({});
    expect(context.outletEntries).toEqual({});
    expect(context.anTop).toEqual([]);
    expect(context.anBottom).toEqual([]);
    expect(context.emTop).toEqual([]);
    expect(context.emBottom).toEqual([]);
  });

  test("falls back to prefix when contentTypeDefault is empty", async () => {
    mocks.getSelectedUserPerson.mockResolvedValue({
      id: "u-1",
      name: "Alice",
      prefix: "Prefix fallback",
      contentTypeDefault: "",
    });

    const context = await buildPromptTemplateRenderContext({ ownerId: "global" });
    expect(context.persona).toBe("Prefix fallback");
  });

  test("stringifies empty char/user as empty strings instead of [object Object]", async () => {
    const context = await buildPromptTemplateRenderContext({ ownerId: "global" });

    expect(String(context.char)).toBe("");
    expect(String(context.user)).toBe("");
  });

  test("publishes outlet and AN/EM WI channels on context", () => {
    const context = applyWorldInfoToTemplateContext(
      {
        char: {},
        user: {},
        chat: {},
        messages: [],
        rag: {},
        art: {},
        now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
      },
      {
        worldInfoBefore: "before",
        worldInfoAfter: "after",
        outletEntries: {
          default: ["one", "two"],
          custom: ["three"],
        },
        anTop: ["an-top"],
        anBottom: ["an-bottom"],
        emTop: ["em-top"],
        emBottom: ["em-bottom"],
      }
    );

    expect(context.wiBefore).toBe("before");
    expect(context.wiAfter).toBe("after");
    expect(context.anchorBefore).toBe("before");
    expect(context.anchorAfter).toBe("after");
    expect(context.loreBefore).toBe("before");
    expect(context.loreAfter).toBe("after");
    expect(context.outletEntries).toEqual({
      default: ["one", "two"],
      custom: ["three"],
    });
    expect(context.outlet).toEqual({
      default: "one\ntwo",
      custom: "three",
    });
    expect(context.anTop).toEqual(["an-top"]);
    expect(context.anBottom).toEqual(["an-bottom"]);
    expect(context.emTop).toEqual(["em-top"]);
    expect(context.emBottom).toEqual(["em-bottom"]);
  });

  test("renders resolved world-info channels with Liquid before applying to context", async () => {
    mocks.getSelectedUserPerson.mockResolvedValue({
      id: "u-1",
      name: "Alice",
      prefix: "Prefix fallback",
      contentTypeDefault: "Persona description",
    });
    mocks.getEntityProfileById.mockResolvedValue({
      id: "c-1",
      spec: { name: "Lilly" },
    });
    mocks.resolveWorldInfoRuntimeForChat.mockResolvedValue({
      worldInfoBefore: "Before {{char}}",
      worldInfoAfter: "After {{char}}",
      depthEntries: [{ depth: 2, role: 0, content: "Depth {{char}}", bookId: "b", uid: 1 }],
      outletEntries: { default: ["Outlet {{char}}"] },
      anTop: ["AN {{char}}"],
      anBottom: [],
      emTop: [],
      emBottom: ["EM {{char}}"],
      activatedEntries: [{}, {}, {}],
      debug: {
        warnings: [],
        matchedKeys: {},
        skips: [],
        budget: { limit: 1, used: 0, overflowed: false },
      },
    });

    const context = await buildPromptTemplateRenderContext({
      ownerId: "global",
      entityProfileId: "c-1",
    });
    const resolved = await resolveAndApplyWorldInfoToTemplateContext({
      context,
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      entityProfileId: "c-1",
      trigger: "generate",
      dryRun: true,
    });

    expect(resolved.worldInfoBefore).toBe("Before Lilly");
    expect(resolved.worldInfoAfter).toBe("After Lilly");
    expect(resolved.depthEntries[0]?.content).toBe("Depth Lilly");
    expect(resolved.outletEntries.default?.[0]).toBe("Outlet Lilly");
    expect(context.wiBefore).toBe("Before Lilly");
    expect(context.outletEntries?.default).toEqual(["Outlet Lilly"]);
  });

  test("falls back to raw world-info text and warning on Liquid render failure", async () => {
    mocks.resolveWorldInfoRuntimeForChat.mockResolvedValue({
      worldInfoBefore: "FAIL_ME {{char}}",
      worldInfoAfter: "ok",
      depthEntries: [],
      outletEntries: {},
      anTop: [],
      anBottom: [],
      emTop: [],
      emBottom: [],
      activatedEntries: [{}, {}],
      debug: {
        warnings: [],
        matchedKeys: {},
        skips: [],
        budget: { limit: 1, used: 0, overflowed: false },
      },
    });
    mocks.renderLiquidTemplate.mockImplementation(
      async ({ templateText }: { templateText: string }) => {
        if (templateText.includes("FAIL_ME")) throw new Error("boom");
        return templateText;
      }
    );

    const context = await buildPromptTemplateRenderContext({ ownerId: "global" });
    const resolved = await resolveAndApplyWorldInfoToTemplateContext({
      context,
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      trigger: "generate",
      dryRun: true,
    });

    expect(resolved.worldInfoBefore).toBe("FAIL_ME {{char}}");
    expect(resolved.warnings.some((item) => item.includes("world_info_liquid_render_error:worldInfoBefore:boom"))).toBe(true);
    expect(context.wiBefore).toBe("FAIL_ME {{char}}");
  });
});
