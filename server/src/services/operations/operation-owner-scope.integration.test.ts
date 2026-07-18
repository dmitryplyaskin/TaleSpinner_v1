import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { exportOperationProfileBundle } from "../../application/operations/use-cases/export-operation-profile";
import { setActiveOperationProfileWithValidation } from "../../application/operations/use-cases/set-active-operation-profile";
import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";

import {
  createOperationBlock,
  deleteOperationBlock,
  getOperationBlockById,
  updateOperationBlock,
} from "./operation-blocks-repository";
import {
  getOperationProfileSettings,
  setActiveOperationProfile,
} from "./operation-profile-settings-repository";
import {
  createOperationProfile,
  getOperationProfileById,
  updateOperationProfile,
} from "./operation-profiles-repository";

describe("operation owner scope", () => {
  let tempDir = "";

  beforeEach(async () => {
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-operation-owner-"));
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("blocks cannot be read, updated, or deleted by another owner", async () => {
    const block = await createOperationBlock({
      ownerId: "owner-a",
      input: { name: "Private block", enabled: true, operations: [] },
    });

    expect(
      await getOperationBlockById({ ownerId: "owner-b", blockId: block.blockId })
    ).toBeNull();
    expect(
      await updateOperationBlock({
        ownerId: "owner-b",
        blockId: block.blockId,
        patch: { name: "Stolen" },
      })
    ).toBeNull();
    expect(
      await deleteOperationBlock({ ownerId: "owner-b", blockId: block.blockId })
    ).toBe(false);

    const original = await getOperationBlockById({
      ownerId: "owner-a",
      blockId: block.blockId,
    });
    expect(original?.name).toBe("Private block");
  });

  test("profiles cannot reference, read, update, or export another owner's data", async () => {
    const block = await createOperationBlock({
      ownerId: "owner-a",
      input: { name: "Owner A block", enabled: true, operations: [] },
    });
    const profile = await createOperationProfile({
      ownerId: "owner-a",
      input: {
        name: "Owner A profile",
        enabled: true,
        executionMode: "concurrent",
        operationProfileSessionId: "11111111-1111-4111-8111-111111111111",
        blockRefs: [{ blockId: block.blockId, enabled: true, order: 0 }],
      },
    });

    await expect(
      createOperationProfile({
        ownerId: "owner-b",
        input: {
          name: "Cross-owner profile",
          enabled: true,
          executionMode: "concurrent",
          operationProfileSessionId: "22222222-2222-4222-8222-222222222222",
          blockRefs: [{ blockId: block.blockId, enabled: true, order: 0 }],
        },
      })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(
      await getOperationProfileById({
        ownerId: "owner-b",
        profileId: profile.profileId,
      })
    ).toBeNull();
    expect(
      await updateOperationProfile({
        ownerId: "owner-b",
        profileId: profile.profileId,
        patch: { name: "Stolen" },
      })
    ).toBeNull();
    await expect(
      exportOperationProfileBundle({
        ownerId: "owner-b",
        profileId: profile.profileId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("active profile settings are isolated by owner", async () => {
    const profile = await createOperationProfile({
      ownerId: "owner-a",
      input: {
        name: "Owner A profile",
        enabled: true,
        executionMode: "sequential",
        operationProfileSessionId: "11111111-1111-4111-8111-111111111111",
        blockRefs: [],
      },
    });

    await setActiveOperationProfile({
      ownerId: "owner-a",
      activeProfileId: profile.profileId,
    });

    expect(await getOperationProfileSettings({ ownerId: "owner-a" })).toMatchObject({
      activeProfileId: profile.profileId,
    });
    expect(await getOperationProfileSettings({ ownerId: "owner-b" })).toMatchObject({
      activeProfileId: null,
    });
    await expect(
      setActiveOperationProfileWithValidation({
        ownerId: "owner-b",
        activeProfileId: profile.profileId,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});
