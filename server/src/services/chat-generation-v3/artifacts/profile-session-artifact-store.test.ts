import { describe, expect, test } from "vitest";

import { ProfileSessionArtifactStore } from "./profile-session-artifact-store";

describe("ProfileSessionArtifactStore resource limits", () => {
  test("rejects oversized values before touching persistence", async () => {
    await expect(
      ProfileSessionArtifactStore.upsert({
        ownerId: "global",
        sessionKey: "session",
        chatId: "chat",
        branchId: "branch",
        profile: null,
        tag: "oversized",
        format: "text",
        semantics: "intermediate",
        writeMode: "replace",
        history: { enabled: true, maxItems: 20 },
        value: "x".repeat(256 * 1024 + 1),
      })
    ).rejects.toMatchObject({ code: "ARTIFACT_VALUE_TOO_LARGE" });
  });
});
