import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSelectedUserPerson: vi.fn(),
  getEntityProfileById: vi.fn(),
  getChatById: vi.fn(),
  listProjectedPromptMessages: vi.fn(),
  resolveWorldInfoRuntimeForChat: vi.fn(),
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

import {
  applyWorldInfoToTemplateContext,
  buildPromptTemplateRenderContext,
} from "./prompt-template-context";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSelectedUserPerson.mockResolvedValue(null);
  mocks.getEntityProfileById.mockResolvedValue(null);
  mocks.getChatById.mockResolvedValue(null);
  mocks.listProjectedPromptMessages.mockResolvedValue({ currentTurn: 0, entryCount: 0, messages: [] });
  mocks.resolveWorldInfoRuntimeForChat.mockResolvedValue(null);
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
});
