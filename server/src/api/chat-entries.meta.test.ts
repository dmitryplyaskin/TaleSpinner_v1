import { describe, expect, test } from "vitest";

import { HttpError } from "@core/middleware/error-handler";

import {
  buildUserEntryMeta,
  mergeEntryPromptVisibilityMeta,
  renderUserInputWithLiquid,
  resolveContinueUserTurnTarget,
} from "./chat-entries.api";

import type { Entry, Variant } from "@shared/types/chat-entry-parts";

describe("buildUserEntryMeta", () => {
  test("includes personaSnapshot when selected persona exists", () => {
    const meta = buildUserEntryMeta({
      requestId: "req-1",
      selectedUser: {
        id: "persona-1",
        name: "Alice",
        avatarUrl: "/media/persona/alice.png",
      },
    });

    expect(meta).toEqual({
      requestId: "req-1",
      personaSnapshot: {
        id: "persona-1",
        name: "Alice",
        avatarUrl: "/media/persona/alice.png",
      },
    });
  });

  test("omits personaSnapshot when persona is not selected", () => {
    const meta = buildUserEntryMeta({
      requestId: "req-2",
      selectedUser: null,
    });

    expect(meta).toEqual({
      requestId: "req-2",
    });
  });

  test("keeps requestId nullable fallback", () => {
    const meta = buildUserEntryMeta({
      selectedUser: null,
    });

    expect(meta).toEqual({
      requestId: null,
    });
  });

  test("includes template render metadata when provided", () => {
    const meta = buildUserEntryMeta({
      requestId: "req-liquid",
      selectedUser: null,
      templateRender: {
        engine: "liquidjs",
        rawContent: "Hi {{user}}",
        renderedContent: "Hi Alice",
        changed: true,
        renderedAt: "2026-02-10T00:00:00.000Z",
      },
    });

    expect(meta).toEqual({
      requestId: "req-liquid",
      templateRender: {
        engine: "liquidjs",
        rawContent: "Hi {{user}}",
        renderedContent: "Hi Alice",
        changed: true,
        renderedAt: "2026-02-10T00:00:00.000Z",
      },
    });
  });

  test("continue target validation fails when last entry is not user", () => {
    const lastEntry: Entry = {
      entryId: "assistant-entry-1",
      chatId: "chat-1",
      branchId: "branch-1",
      role: "assistant",
      createdAt: Date.now(),
      activeVariantId: "variant-1",
    };

    expect(() =>
      resolveContinueUserTurnTarget({
        lastEntry,
        lastVariant: null,
      })
    ).toThrowError(HttpError);
  });

  test("continue target validation fails when user entry has no editable main part", () => {
    const lastEntry: Entry = {
      entryId: "user-entry-1",
      chatId: "chat-1",
      branchId: "branch-1",
      role: "user",
      createdAt: Date.now(),
      activeVariantId: "variant-1",
    };
    const lastVariant: Variant = {
      variantId: "variant-1",
      entryId: "user-entry-1",
      kind: "manual_edit",
      createdAt: Date.now(),
      parts: [
        {
          partId: "part-1",
          channel: "aux",
          order: 0,
          payload: "not-main",
          payloadFormat: "markdown",
          visibility: { ui: "always", prompt: true },
          ui: { rendererId: "markdown" },
          prompt: { serializerId: "asText" },
          lifespan: "infinite",
          createdTurn: 1,
          source: "user",
        },
      ],
    };

    expect(() =>
      resolveContinueUserTurnTarget({
        lastEntry,
        lastVariant,
      })
    ).toThrowError(HttpError);
  });

  test("continue target validation returns user entry and editable main part", () => {
    const lastEntry: Entry = {
      entryId: "user-entry-1",
      chatId: "chat-1",
      branchId: "branch-1",
      role: "user",
      createdAt: Date.now(),
      activeVariantId: "variant-1",
    };
    const lastVariant: Variant = {
      variantId: "variant-1",
      entryId: "user-entry-1",
      kind: "manual_edit",
      createdAt: Date.now(),
      parts: [
        {
          partId: "part-old",
          channel: "main",
          order: 0,
          payload: "hello",
          payloadFormat: "markdown",
          visibility: { ui: "always", prompt: true },
          ui: { rendererId: "markdown" },
          prompt: { serializerId: "asText" },
          lifespan: "infinite",
          createdTurn: 1,
          source: "user",
        },
        {
          partId: "part-new",
          channel: "main",
          order: 1,
          payload: "hello-v2",
          payloadFormat: "text",
          visibility: { ui: "always", prompt: true },
          ui: { rendererId: "markdown" },
          prompt: { serializerId: "asText" },
          lifespan: "infinite",
          createdTurn: 2,
          source: "user",
        },
      ],
    };

    expect(
      resolveContinueUserTurnTarget({
        lastEntry,
        lastVariant,
      })
    ).toEqual({
      userEntryId: "user-entry-1",
      userMainPartId: "part-new",
    });
  });
});

describe("mergeEntryPromptVisibilityMeta", () => {
  test("preserves unrelated meta fields and adds excludedFromPrompt when includeInPrompt=false", () => {
    const next = mergeEntryPromptVisibilityMeta({
      existingMeta: { requestId: "req-1", custom: { a: 1 } },
      includeInPrompt: false,
    });

    expect(next).toEqual({
      requestId: "req-1",
      custom: { a: 1 },
      excludedFromPrompt: true,
    });
  });

  test("removes excludedFromPrompt when includeInPrompt=true", () => {
    const next = mergeEntryPromptVisibilityMeta({
      existingMeta: { requestId: "req-1", excludedFromPrompt: true },
      includeInPrompt: true,
    });

    expect(next).toEqual({ requestId: "req-1" });
  });

  test("returns null when only excludedFromPrompt was present and includeInPrompt=true", () => {
    const next = mergeEntryPromptVisibilityMeta({
      existingMeta: { excludedFromPrompt: true },
      includeInPrompt: true,
    });

    expect(next).toBeNull();
  });
});

describe("renderUserInputWithLiquid", () => {
  const context = {
    char: {},
    user: { name: "Alice" },
    chat: {},
    messages: [],
    rag: {},
    art: {},
    now: new Date("2026-02-10T00:00:00.000Z").toISOString(),
  };

  test("returns same text for plain input", async () => {
    const rendered = await renderUserInputWithLiquid({
      content: "Just text",
      context,
    });

    expect(rendered).toEqual({
      renderedContent: "Just text",
      changed: false,
    });
  });

  test("renders valid liquid template", async () => {
    const rendered = await renderUserInputWithLiquid({
      content: "Hi {{user.name}}",
      context,
    });

    expect(rendered).toEqual({
      renderedContent: "Hi Alice",
      changed: true,
    });
  });

  test("renders nested liquid values recursively up to depth 3", async () => {
    const rendered = await renderUserInputWithLiquid({
      content: "{{description}}",
      context: {
        ...context,
        description: "{{persona}}",
        persona: "{{user.name}}",
      },
    });

    expect(rendered).toEqual({
      renderedContent: "Alice",
      changed: true,
    });
  });

  test("throws HttpError on liquid syntax error", async () => {
    await expect(
      renderUserInputWithLiquid({
        content: "Hi {{",
        context,
      })
    ).rejects.toBeInstanceOf(HttpError);
  });

  test("throws HttpError when rendered output is empty", async () => {
    await expect(
      renderUserInputWithLiquid({
        content: "{{missing.value}}",
        context,
      })
    ).rejects.toBeInstanceOf(HttpError);
  });

  test("allows empty rendered output when allowEmptyResult=true", async () => {
    const rendered = await renderUserInputWithLiquid({
      content: "{{missing.value}}",
      context,
      options: { allowEmptyResult: true },
    });

    expect(rendered).toEqual({
      renderedContent: "",
      changed: true,
    });
  });
});
