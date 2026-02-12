import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPromptTemplateRenderContext: vi.fn(),
  resolveAndApplyWorldInfoToTemplateContext: vi.fn(),
  pickPromptTemplateForChat: vi.fn(),
  listProjectedPromptMessages: vi.fn(),
}));

vi.mock("../../chat-core/prompt-template-context", () => ({
  buildPromptTemplateRenderContext: mocks.buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext: mocks.resolveAndApplyWorldInfoToTemplateContext,
}));

vi.mock("../../chat-core/prompt-templates-repository", () => ({
  pickPromptTemplateForChat: mocks.pickPromptTemplateForChat,
}));

vi.mock("../../chat-entry-parts/prompt-history", () => ({
  listProjectedPromptMessages: mocks.listProjectedPromptMessages,
}));

import { buildBasePrompt } from "./build-base-prompt";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildPromptTemplateRenderContext.mockResolvedValue({
    char: { name: "Lilly" },
    user: {},
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  });
  mocks.resolveAndApplyWorldInfoToTemplateContext.mockResolvedValue({
    worldInfoBefore: "WI BEFORE",
    worldInfoAfter: "WI AFTER",
    depthEntries: [{ depth: 3, role: 0, content: "WI DEPTH", bookId: "b-1", uid: 10 }],
    outletEntries: {},
    anTop: [],
    anBottom: [],
    emTop: [],
    emBottom: [],
    warnings: [],
    activatedCount: 2,
  });
  mocks.pickPromptTemplateForChat.mockResolvedValue(null);
  mocks.listProjectedPromptMessages.mockResolvedValue({
    currentTurn: 1,
    entryCount: 1,
    messages: [{ role: "user", content: "hello" }],
  });
});

describe("buildBasePrompt explicit-only WI integration", () => {
  test("does not auto-inject WI as extra system message when template has no WI placeholders", async () => {
    const out = await buildBasePrompt({
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "entity-1",
      historyLimit: 50,
      trigger: "generate",
    });

    expect(out.prompt.draftMessages).toEqual([
      { role: "system", content: "You are a helpful assistant." },
      { role: "user", content: "hello" },
    ]);
    expect(
      out.prompt.draftMessages.filter((msg) => msg.role === "system").length
    ).toBe(1);
    expect(out.prompt.promptSnapshot.meta.worldInfo).toEqual(
      expect.objectContaining({
        activatedCount: 2,
        beforeChars: "WI BEFORE".length,
        afterChars: "WI AFTER".length,
      })
    );
  });

  test("injects WI only via explicit template placeholder and keeps single system message", async () => {
    mocks.pickPromptTemplateForChat.mockResolvedValue({
      id: "tpl-1",
      ownerId: "global",
      name: "tpl",
      engine: "liquidjs",
      templateText: "SYS\n{{wiBefore}}\nEND",
      meta: null,
      createdAt: new Date("2026-02-10T00:00:00.000Z"),
      updatedAt: new Date("2026-02-10T00:00:00.000Z"),
    });
    mocks.resolveAndApplyWorldInfoToTemplateContext.mockImplementation(
      async ({ context }: { context: { wiBefore?: string } }) => {
        context.wiBefore = "WI BEFORE";
        return {
          worldInfoBefore: "WI BEFORE",
          worldInfoAfter: "WI AFTER",
          depthEntries: [],
          outletEntries: {},
          anTop: [],
          anBottom: [],
          emTop: [],
          emBottom: [],
          warnings: [],
          activatedCount: 1,
        };
      }
    );

    const out = await buildBasePrompt({
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "entity-1",
      historyLimit: 50,
      trigger: "generate",
    });

    expect(out.prompt.draftMessages).toEqual([
      { role: "system", content: "SYS\nWI BEFORE\nEND" },
      { role: "user", content: "hello" },
    ]);
    expect(
      out.prompt.draftMessages.filter((msg) => msg.role === "system").length
    ).toBe(1);
  });
});

