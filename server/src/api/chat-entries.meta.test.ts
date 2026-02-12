import { describe, expect, test } from "vitest";

import { HttpError } from "@core/middleware/error-handler";

import {
  buildLatestWorldInfoActivationsFromGeneration,
  buildPromptDiagnosticsFromDebug,
  buildPromptDiagnosticsFromSnapshot,
  buildUserEntryMeta,
  emptyLatestWorldInfoActivationsResponse,
  mergeEntryPromptVisibilityMeta,
  pickPreviousUserEntries,
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

  test("pickPreviousUserEntries returns users before anchor from nearest to oldest", () => {
    const entries: Entry[] = [
      {
        entryId: "system-1",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "system",
        createdAt: 1,
        activeVariantId: "variant-system",
      },
      {
        entryId: "user-1",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "user",
        createdAt: 2,
        activeVariantId: "variant-user-1",
      },
      {
        entryId: "assistant-1",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "assistant",
        createdAt: 3,
        activeVariantId: "variant-assistant-1",
      },
      {
        entryId: "user-2",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "user",
        createdAt: 4,
        activeVariantId: "variant-user-2",
      },
      {
        entryId: "assistant-target",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "assistant",
        createdAt: 5,
        activeVariantId: "variant-assistant-target",
      },
    ];

    const picked = pickPreviousUserEntries({
      entries,
      anchorEntryId: "assistant-target",
    });

    expect(picked.map((entry) => entry.entryId)).toEqual(["user-2", "user-1"]);
  });

  test("pickPreviousUserEntries skips soft-deleted user entries", () => {
    const entries: Entry[] = [
      {
        entryId: "user-deleted",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "user",
        createdAt: 1,
        activeVariantId: "variant-user-deleted",
        softDeleted: true,
      },
      {
        entryId: "assistant-target",
        chatId: "chat-1",
        branchId: "branch-1",
        role: "assistant",
        createdAt: 2,
        activeVariantId: "variant-assistant-target",
      },
    ];

    const picked = pickPreviousUserEntries({
      entries,
      anchorEntryId: "assistant-target",
    });

    expect(picked).toEqual([]);
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

describe("prompt diagnostics helpers", () => {
  test("buildPromptDiagnosticsFromDebug returns normalized payload", () => {
    const data = buildPromptDiagnosticsFromDebug({
      generation: {
        id: "gen-1",
        chatId: "chat-1",
        branchId: "branch-1",
        messageId: null,
        variantId: "variant-1",
        status: "done",
        startedAt: new Date("2026-02-12T12:00:00.000Z"),
        finishedAt: new Date("2026-02-12T12:00:05.000Z"),
        error: null,
        promptHash: "hash-1",
        promptSnapshot: null,
        debug: {
          estimator: "chars_div4",
          prompt: {
            messages: [{ role: "system", content: "sys" }],
            approxTokens: {
              total: 3,
              byRole: { system: 3, user: 0, assistant: 0 },
              sections: {
                systemInstruction: 3,
                chatHistory: 0,
                worldInfoBefore: 0,
                worldInfoAfter: 0,
                worldInfoDepth: 0,
                worldInfoOutlets: 0,
                worldInfoAN: 0,
                worldInfoEM: 0,
              },
            },
          },
        },
      },
      entryId: "entry-1",
      variantId: "variant-1",
    });

    expect(data).toEqual(
      expect.objectContaining({
        generationId: "gen-1",
        entryId: "entry-1",
        variantId: "variant-1",
        estimator: "chars_div4",
        prompt: expect.objectContaining({
          messages: [{ role: "system", content: "sys" }],
        }),
        turnCanonicalizations: [],
      })
    );
  });

  test("buildPromptDiagnosticsFromDebug includes user turn canonicalization history", () => {
    const data = buildPromptDiagnosticsFromDebug({
      generation: {
        id: "gen-1",
        chatId: "chat-1",
        branchId: "branch-1",
        messageId: null,
        variantId: "variant-1",
        status: "done",
        startedAt: new Date("2026-02-12T12:00:00.000Z"),
        finishedAt: new Date("2026-02-12T12:00:05.000Z"),
        error: null,
        promptHash: "hash-1",
        promptSnapshot: null,
        debug: {
          estimator: "chars_div4",
          prompt: {
            messages: [{ role: "system", content: "sys" }],
            approxTokens: {
              total: 3,
              byRole: { system: 3, user: 0, assistant: 0 },
              sections: {
                systemInstruction: 3,
                chatHistory: 0,
                worldInfoBefore: 0,
                worldInfoAfter: 0,
                worldInfoDepth: 0,
                worldInfoOutlets: 0,
                worldInfoAN: 0,
                worldInfoEM: 0,
              },
            },
          },
          operations: {
            turnUserCanonicalization: [
              {
                hook: "before_main_llm",
                opId: "canon-op",
                userEntryId: "user-entry-1",
                userMainPartId: "part-1",
                beforeText: "raw",
                afterText: "normalized",
                committedAt: "2026-02-12T12:00:01.000Z",
              },
            ],
          },
        },
      },
      entryId: "entry-1",
      variantId: "variant-1",
    });

    expect(data?.turnCanonicalizations).toEqual([
      {
        hook: "before_main_llm",
        opId: "canon-op",
        userEntryId: "user-entry-1",
        userMainPartId: "part-1",
        beforeText: "raw",
        afterText: "normalized",
        committedAt: "2026-02-12T12:00:01.000Z",
      },
    ]);
  });

  test("buildPromptDiagnosticsFromSnapshot falls back when debug is missing", () => {
    const data = buildPromptDiagnosticsFromSnapshot({
      generation: {
        id: "gen-2",
        chatId: "chat-1",
        branchId: "branch-1",
        messageId: null,
        variantId: "variant-1",
        status: "done",
        startedAt: new Date("2026-02-12T12:10:00.000Z"),
        finishedAt: new Date("2026-02-12T12:10:05.000Z"),
        error: null,
        promptHash: "hash-2",
        debug: null,
        promptSnapshot: {
          v: 1,
          messages: [
            { role: "system", content: "sys" },
            { role: "user", content: "hello" },
          ],
          truncated: false,
          meta: {
            historyLimit: 50,
            historyReturnedCount: 1,
            worldInfo: {
              activatedCount: 1,
              beforeChars: 24,
              afterChars: 0,
              warnings: [],
            },
          },
        },
      },
      entryId: "entry-1",
      variantId: "variant-1",
    });

    expect(data?.prompt.approxTokens.sections.worldInfoBefore).toBeGreaterThan(0);
    expect(data?.prompt.messages).toHaveLength(2);
  });

  test("buildLatestWorldInfoActivationsFromGeneration extracts entries", () => {
    const data = buildLatestWorldInfoActivationsFromGeneration({
      id: "gen-3",
      chatId: "chat-1",
      branchId: "branch-1",
      messageId: null,
      variantId: "variant-1",
      status: "done",
      startedAt: new Date("2026-02-12T13:00:00.000Z"),
      finishedAt: new Date("2026-02-12T13:00:05.000Z"),
      error: null,
      promptHash: "hash-3",
      promptSnapshot: null,
      debug: {
        worldInfo: {
          activatedCount: 1,
          warnings: ["w1"],
          entries: [
            {
              hash: "h1",
              bookId: "book-1",
              bookName: "Book",
              uid: 7,
              comment: "Entry",
              content: "Lore",
              matchedKeys: ["dragon"],
              reasons: ["key_match"],
            },
          ],
        },
      },
    });

    expect(data?.generationId).toBe("gen-3");
    expect(data?.entries[0]?.matchedKeys).toEqual(["dragon"]);
    expect(data?.warnings).toEqual(["w1"]);
  });

  test("emptyLatestWorldInfoActivationsResponse returns null-like payload", () => {
    expect(emptyLatestWorldInfoActivationsResponse()).toEqual({
      generationId: null,
      startedAt: null,
      status: null,
      activatedCount: 0,
      warnings: [],
      entries: [],
    });
  });
});
