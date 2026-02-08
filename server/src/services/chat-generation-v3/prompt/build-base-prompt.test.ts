import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildPromptTemplateRenderContext: vi.fn(),
  pickPromptTemplateForChat: vi.fn(),
  renderLiquidTemplate: vi.fn(),
  buildPromptDraft: vi.fn(),
  resolveWorldInfoRuntime: vi.fn(),
}));

vi.mock("../../chat-core/prompt-template-context", () => ({
  buildPromptTemplateRenderContext: mocks.buildPromptTemplateRenderContext,
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
vi.mock("../../world-info/world-info-runtime", () => ({
  resolveWorldInfoRuntime: mocks.resolveWorldInfoRuntime,
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
  mocks.resolveWorldInfoRuntime.mockResolvedValue({
    worldInfoBefore: "BEFORE",
    worldInfoAfter: "AFTER",
    depthEntries: [],
    outletEntries: {},
    anTop: [],
    anBottom: [],
    emTop: [],
    emBottom: [],
    activatedEntries: [],
    debug: {
      warnings: ["w1"],
      matchedKeys: {},
      skips: [],
      budget: { limit: 100, used: 10, overflowed: false },
    },
  });
});

describe("buildBasePrompt world-info integration", () => {
  test("passes world info before/after to draft builder", async () => {
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
        worldInfoMeta: expect.objectContaining({
          beforeChars: 6,
          afterChars: 5,
        }),
      })
    );
  });
});
