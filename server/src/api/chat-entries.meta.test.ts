import { describe, expect, test } from "vitest";

import { buildUserEntryMeta } from "./chat-entries.api";

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
});
