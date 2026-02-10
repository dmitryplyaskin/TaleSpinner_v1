import { describe, expect, test, vi } from "vitest";

import { ProfileSessionArtifactStore } from "../../artifacts/profile-session-artifact-store";
import { RunArtifactStore } from "../../artifacts/run-artifact-store";
import { applyArtifactEffect } from "./artifact-effects";

describe("applyArtifactEffect", () => {
  test("writes run_only artifacts into RunArtifactStore", async () => {
    const store = new RunArtifactStore();

    const out = await applyArtifactEffect({
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      sessionKey: null,
      profile: null,
      runStore: store,
      effect: {
        tag: "tmp",
        persistence: "run_only",
        usage: "internal",
        semantics: "intermediate",
        value: "v1",
      },
    });

    expect(out).toEqual({
      usage: "internal",
      semantics: "intermediate",
      persistence: "run_only",
      value: "v1",
      history: ["v1"],
    });
    expect(store.get("tmp")?.value).toBe("v1");
  });

  test("throws for persisted artifact without session key", async () => {
    await expect(
      applyArtifactEffect({
        ownerId: "global",
        chatId: "chat",
        branchId: "branch",
        sessionKey: null,
        profile: null,
        runStore: new RunArtifactStore(),
        effect: {
          tag: "state",
          persistence: "persisted",
          usage: "prompt+ui",
          semantics: "state",
          value: "v",
        },
      })
    ).rejects.toThrow(/without session key/);
  });

  test("delegates persisted write to ProfileSessionArtifactStore.upsert", async () => {
    const upsertSpy = vi.spyOn(ProfileSessionArtifactStore, "upsert").mockResolvedValue({
      usage: "prompt+ui",
      semantics: "state",
      persistence: "persisted",
      value: "persisted-v",
      history: ["persisted-v"],
    });

    const out = await applyArtifactEffect({
      ownerId: "global",
      chatId: "chat",
      branchId: "branch",
      sessionKey: "sess-1",
      profile: {
        profileId: "a8b9ea7e-acf5-4820-a1f0-4dca3ae8d22c",
        ownerId: "global",
        name: "p",
        enabled: true,
        executionMode: "sequential",
        operationProfileSessionId: "2d4fbad2-f9e8-470d-bee8-5e860abf32ca",
        version: 1,
        operations: [],
        meta: null,
        createdAt: new Date("2026-02-10T00:00:00.000Z"),
        updatedAt: new Date("2026-02-10T00:00:00.000Z"),
      },
      runStore: new RunArtifactStore(),
      effect: {
        tag: "world_state",
        persistence: "persisted",
        usage: "prompt+ui",
        semantics: "state",
        value: "persisted-v",
      },
    });

    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "global",
        sessionKey: "sess-1",
        tag: "world_state",
        usage: "prompt+ui",
        semantics: "state",
        value: "persisted-v",
      })
    );
    expect(out).toEqual({
      usage: "prompt+ui",
      semantics: "state",
      persistence: "persisted",
      value: "persisted-v",
      history: ["persisted-v"],
    });
  });
});
