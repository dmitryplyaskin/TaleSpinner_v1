import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  hasActiveUserEntriesInBranch: vi.fn(),
  listEntries: vi.fn(),
  listEntryVariants: vi.fn(),
  updatePartPayloadText: vi.fn(),
  updateVariantDerived: vi.fn(),
  buildPromptTemplateRenderContext: vi.fn(),
  resolveAndApplyWorldInfoToTemplateContext: vi.fn(),
  renderLiquidTemplate: vi.fn(),
}));

vi.mock("../chat-entry-parts/entries-repository", () => ({
  hasActiveUserEntriesInBranch: mocks.hasActiveUserEntriesInBranch,
  listEntries: mocks.listEntries,
}));

vi.mock("../chat-entry-parts/variants-repository", () => ({
  listEntryVariants: mocks.listEntryVariants,
  updateVariantDerived: mocks.updateVariantDerived,
}));

vi.mock("../chat-entry-parts/parts-repository", () => ({
  updatePartPayloadText: mocks.updatePartPayloadText,
}));

vi.mock("./prompt-template-context", () => ({
  buildPromptTemplateRenderContext: mocks.buildPromptTemplateRenderContext,
  resolveAndApplyWorldInfoToTemplateContext: mocks.resolveAndApplyWorldInfoToTemplateContext,
}));

vi.mock("./prompt-template-renderer", () => ({
  renderLiquidTemplate: mocks.renderLiquidTemplate,
}));

import { rerenderGreetingTemplatesIfPreplay } from "./greeting-template-rerender";

function makeContext() {
  return {
    char: {},
    user: { id: "u-1", name: "Alice" },
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  };
}

describe("rerenderGreetingTemplatesIfPreplay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.hasActiveUserEntriesInBranch.mockResolvedValue(false);
    mocks.listEntries.mockResolvedValue([
      {
        entryId: "entry-1",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "assistant",
        createdAt: 1,
        activeVariantId: "v-1",
        meta: { source: "entity_profile_import", kind: "first_mes" },
      },
    ]);
    mocks.listEntryVariants.mockResolvedValue([
      {
        variantId: "v-1",
        entryId: "entry-1",
        kind: "import",
        createdAt: 1,
        parts: [
          {
            partId: "p-1",
            channel: "main",
            order: 0,
            payload: "Hi {{user}}",
            payloadFormat: "markdown",
            visibility: { ui: "always", prompt: true },
            ui: { rendererId: "markdown" },
            prompt: { serializerId: "asText" },
            lifespan: "infinite",
            createdTurn: 0,
            source: "import",
          },
        ],
        derived: {
          templateSeed: {
            engine: "liquidjs",
            rawTemplate: "Hi {{user}}",
            renderedForUserPersonId: null,
            renderedAt: "2026-02-09T00:00:00.000Z",
          },
        },
      },
    ]);
    mocks.buildPromptTemplateRenderContext.mockResolvedValue(makeContext());
    mocks.resolveAndApplyWorldInfoToTemplateContext.mockResolvedValue({
      worldInfoBefore: "",
      worldInfoAfter: "",
      depthEntries: [],
      outletEntries: {},
      anTop: [],
      anBottom: [],
      emTop: [],
      emBottom: [],
      warnings: [],
      activatedCount: 0,
    });
    mocks.renderLiquidTemplate.mockResolvedValue("Hi Alice");
    mocks.updatePartPayloadText.mockResolvedValue(undefined);
    mocks.updateVariantDerived.mockResolvedValue(undefined);
  });

  test("rerenders greeting variants in preplay and updates templateSeed metadata", async () => {
    await rerenderGreetingTemplatesIfPreplay({
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "profile-1",
    });

    expect(mocks.renderLiquidTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateText: "Hi {{user}}",
        options: expect.objectContaining({ strictVariables: false, maxPasses: 3 }),
      })
    );
    expect(mocks.updatePartPayloadText).toHaveBeenCalledWith({
      partId: "p-1",
      payloadText: "Hi Alice",
      payloadFormat: "markdown",
    });
    expect(mocks.updateVariantDerived).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: "v-1",
        derived: expect.objectContaining({
          templateSeed: expect.objectContaining({
            engine: "liquidjs",
            rawTemplate: "Hi {{user}}",
            renderedForUserPersonId: "u-1",
          }),
        }),
      })
    );
  });

  test("does nothing when chat is already in-play", async () => {
    mocks.hasActiveUserEntriesInBranch.mockResolvedValue(true);

    await rerenderGreetingTemplatesIfPreplay({
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "profile-1",
    });

    expect(mocks.listEntries).not.toHaveBeenCalled();
    expect(mocks.renderLiquidTemplate).not.toHaveBeenCalled();
    expect(mocks.updatePartPayloadText).not.toHaveBeenCalled();
  });

  test("uses current main payload as fallback raw template for legacy variants", async () => {
    mocks.listEntryVariants.mockResolvedValue([
      {
        variantId: "v-legacy",
        entryId: "entry-1",
        kind: "import",
        createdAt: 1,
        parts: [
          {
            partId: "p-legacy",
            channel: "main",
            order: 0,
            payload: "Legacy {{user}}",
            payloadFormat: "markdown",
            visibility: { ui: "always", prompt: true },
            ui: { rendererId: "markdown" },
            prompt: { serializerId: "asText" },
            lifespan: "infinite",
            createdTurn: 0,
            source: "import",
          },
        ],
        derived: null,
      },
    ]);
    mocks.renderLiquidTemplate.mockResolvedValue("Legacy Alice");

    await rerenderGreetingTemplatesIfPreplay({
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "profile-1",
    });

    expect(mocks.renderLiquidTemplate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateText: "Legacy {{user}}",
      })
    );
    expect(mocks.updateVariantDerived).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: "v-legacy",
        derived: expect.objectContaining({
          templateSeed: expect.objectContaining({
            rawTemplate: "Legacy {{user}}",
          }),
        }),
      })
    );
  });

  test("continues processing other variants when one render fails", async () => {
    mocks.listEntryVariants.mockResolvedValue([
      {
        variantId: "v-err",
        entryId: "entry-1",
        kind: "import",
        createdAt: 1,
        parts: [
          {
            partId: "p-err",
            channel: "main",
            order: 0,
            payload: "Bad {{",
            payloadFormat: "markdown",
            visibility: { ui: "always", prompt: true },
            ui: { rendererId: "markdown" },
            prompt: { serializerId: "asText" },
            lifespan: "infinite",
            createdTurn: 0,
            source: "import",
          },
        ],
        derived: null,
      },
      {
        variantId: "v-ok",
        entryId: "entry-1",
        kind: "import",
        createdAt: 2,
        parts: [
          {
            partId: "p-ok",
            channel: "main",
            order: 0,
            payload: "Hi {{user}}",
            payloadFormat: "markdown",
            visibility: { ui: "always", prompt: true },
            ui: { rendererId: "markdown" },
            prompt: { serializerId: "asText" },
            lifespan: "infinite",
            createdTurn: 0,
            source: "import",
          },
        ],
        derived: null,
      },
    ]);
    mocks.renderLiquidTemplate
      .mockRejectedValueOnce(new Error("bad template"))
      .mockResolvedValueOnce("Hi Alice");

    await rerenderGreetingTemplatesIfPreplay({
      ownerId: "global",
      chatId: "chat-1",
      branchId: "branch-1",
      entityProfileId: "profile-1",
    });

    expect(mocks.updateVariantDerived).toHaveBeenCalledTimes(2);
    expect(mocks.updatePartPayloadText).toHaveBeenCalledWith({
      partId: "p-ok",
      payloadText: "Hi Alice",
      payloadFormat: "markdown",
    });
  });
});
