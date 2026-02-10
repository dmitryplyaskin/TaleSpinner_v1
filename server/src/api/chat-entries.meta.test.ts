import { describe, expect, test } from "vitest";

import { HttpError } from "@core/middleware/error-handler";

import { buildUserEntryMeta, resolveContinueUserTurnTarget } from "./chat-entries.api";

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
