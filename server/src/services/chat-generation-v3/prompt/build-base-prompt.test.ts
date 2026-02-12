import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPromptTemplateRenderContext: vi.fn(),
  resolveAndApplyWorldInfoToTemplateContext: vi.fn(),
  pickPromptTemplateForChat: vi.fn(),
  renderLiquidTemplate: vi.fn(),
  buildPromptDraft: vi.fn(),
}));

vi.mock("../../chat-core/prompt-template-context", () => ({
  buildPromptTemplateRenderContext: mocks.buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext: mocks.resolveAndApplyWorldInfoToTemplateContext,
}));
vi.mock("../../chat-core/prompt-templates-repository", () => ({
  pickPromptTemplateForChat: mocks.pickPromptTemplateForChat,
}));
vi.mock("../../chat-core/prompt-template-renderer", () => ({
  renderLiquidTemplate: mocks.renderLiquidTemplate,
}));
vi.mock("../../chat-core/prompt-draft-builder", () => ({
  buildPromptDraft: mocks.buildPromptDraft,
}));

import { buildBasePrompt } from "./build-base-prompt";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.buildPromptTemplateRenderContext.mockResolvedValue({
    char: {},
    user: {},
    chat: {},
    messages: [{ role: "user", content: "hello" }],
    rag: {},
    art: {},
    now: new Date().toISOString(),
  });
  mocks.resolveAndApplyWorldInfoToTemplateContext.mockResolvedValue({
    worldInfoBefore: "BEFORE",
    worldInfoAfter: "AFTER",
    depthEntries: [{ depth: 2, role: 0, content: "DEPTH", bookId: "b", uid: 1 }],
    outletEntries: {},
    anTop: [],
    anBottom: [],
    emTop: [],
    emBottom: [],
    warnings: ["w1"],
    activatedCount: 3,
    activatedEntries: [],
  });
  mocks.pickPromptTemplateForChat.mockResolvedValue(null);
  mocks.buildPromptDraft.mockResolvedValue({
    draft: { messages: [{ role: "system", content: "sys" }] },
    llmMessages: [{ role: "system", content: "sys" }],
    trimming: { historyLimit: 50, excludedMessageIdsCount: 0, historyReturnedCount: 1 },
    promptHash: "hash",
    promptSnapshot: {
      v: 1,
      messages: [{ role: "system", content: "sys" }],
      truncated: false,
      meta: { historyLimit: 50, historyReturnedCount: 1 },
    },
    artifactInclusions: [],
  });
});

describe("buildBasePrompt world-info integration", () => {
  test("passes world info meta but does not auto-inject WI channels into draft", async () => {
    await buildBasePrompt({
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      entityProfileId: "entity",
      historyLimit: 50,
      trigger: "generate",
    });

    const params = mocks.buildPromptDraft.mock.calls[0]?.[0];
    expect(params.preHistorySystemMessages).toBeUndefined();
    expect(params.postHistorySystemMessages).toBeUndefined();
    expect(params.depthInsertions).toBeUndefined();
    expect(params.worldInfoMeta).toEqual(
      expect.objectContaining({
        activatedCount: 3,
        beforeChars: 6,
        afterChars: 5,
      })
    );
  });

  test("renders system prompt from template with WI context placeholders", async () => {
    mocks.resolveAndApplyWorldInfoToTemplateContext.mockImplementation(
      async ({ context }: { context: { wiBefore?: string } }) => {
        context.wiBefore = "BEFORE";
        return {
          worldInfoBefore: "BEFORE",
          worldInfoAfter: "AFTER",
          depthEntries: [{ depth: 2, role: 0, content: "DEPTH", bookId: "b", uid: 1 }],
          outletEntries: {},
          anTop: [],
          anBottom: [],
          emTop: [],
          emBottom: [],
          warnings: ["w1"],
          activatedCount: 3,
          activatedEntries: [],
        };
      }
    );
    mocks.pickPromptTemplateForChat.mockResolvedValue({
      id: "tpl-1",
      ownerId: "global",
      name: "tpl",
      engine: "liquidjs",
      templateText: "{{wiBefore}}\nbase",
      meta: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mocks.renderLiquidTemplate.mockImplementation(
      async ({ context }: { context: { wiBefore?: string } }) =>
        `${context.wiBefore ?? ""}\nbase`
    );

    await buildBasePrompt({
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      entityProfileId: "entity",
      historyLimit: 50,
      trigger: "generate",
    });

    expect(mocks.buildPromptDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "BEFORE\nbase",
      })
    );
  });
});
