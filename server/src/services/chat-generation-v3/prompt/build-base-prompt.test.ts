import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPromptTemplateRenderContext: vi.fn(),
  resolveAndApplyWorldInfoToTemplateContext: vi.fn(),
  hasWorldInfoTemplatePlaceholders: vi.fn(),
  pickPromptTemplateForChat: vi.fn(),
  renderLiquidTemplate: vi.fn(),
  buildPromptDraft: vi.fn(),
}));

vi.mock("../../chat-core/prompt-template-context", () => ({
  buildPromptTemplateRenderContext: mocks.buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext: mocks.resolveAndApplyWorldInfoToTemplateContext,
  hasWorldInfoTemplatePlaceholders: mocks.hasWorldInfoTemplatePlaceholders,
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
  });
  mocks.hasWorldInfoTemplatePlaceholders.mockReturnValue(false);
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
  test("passes world info before/after/depth to draft builder", async () => {
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
        preHistorySystemMessages: ["BEFORE"],
        postHistorySystemMessages: ["AFTER"],
        depthInsertions: [{ depth: 2, role: "system", content: "DEPTH" }],
        worldInfoMeta: expect.objectContaining({
          activatedCount: 3,
          beforeChars: 6,
          afterChars: 5,
        }),
      })
    );
  });

  test("skips auto before/after insertion when template has explicit WI placeholders", async () => {
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
    mocks.hasWorldInfoTemplatePlaceholders.mockReturnValue(true);
    mocks.renderLiquidTemplate.mockResolvedValue("base");

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
        preHistorySystemMessages: [],
        postHistorySystemMessages: [],
      })
    );
  });
});
