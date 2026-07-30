import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "@core/request-context/owner-scope-storage";

import {
  readEntityProfileAvatarFile,
  resolveEntityProfileMediaPath,
  saveEntityProfileAvatarPng,
} from "./entity-profile-media";

const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const FIRST_OWNER = "11111111-1111-4111-8111-111111111111";
const SECOND_OWNER = "22222222-2222-4222-8222-222222222222";

let tempDir = "";
let previousDataDir: string | undefined;

describe("entity profile media ownership", () => {
  beforeEach(async () => {
    previousDataDir = process.env.DATA_DIR;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "entity-media-"));
    process.env.DATA_DIR = tempDir;
  });

  afterEach(async () => {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("stores avatars in the active owner namespace", async () => {
    const url = await runWithOwnerScope(FIRST_OWNER, () =>
      saveEntityProfileAvatarPng(PNG)
    );

    expect(url).toMatch(
      new RegExp(`^/media/images/entity-profiles/${FIRST_OWNER}/.+\\.png$`)
    );
    await expect(
      runWithOwnerScope(FIRST_OWNER, () => readEntityProfileAvatarFile(url))
    ).resolves.toMatchObject({ data: PNG, mediaType: "image/png" });
  });

  test("does not resolve another owner's avatar or traversal input", async () => {
    const url = await runWithOwnerScope(FIRST_OWNER, () =>
      saveEntityProfileAvatarPng(PNG)
    );

    expect(
      runWithOwnerScope(SECOND_OWNER, () =>
        resolveEntityProfileMediaPath(url)
      )
    ).toBeNull();
    expect(
      runWithOwnerScope(FIRST_OWNER, () =>
        resolveEntityProfileMediaPath(
          `/media/images/entity-profiles/${FIRST_OWNER}/%2e%2e`
        )
      )
    ).toBeNull();
  });

  test("keeps legacy unnamespaced avatars available only to global", async () => {
    const legacyDir = path.join(
      tempDir,
      "media",
      "images",
      "entity-profiles"
    );
    await fs.mkdir(legacyDir, { recursive: true });
    await fs.writeFile(path.join(legacyDir, "legacy.png"), PNG);
    const url = "/media/images/entity-profiles/legacy.png";

    expect(
      runWithOwnerScope("global", () => resolveEntityProfileMediaPath(url))
    ).toBe(path.join(legacyDir, "legacy.png"));
    expect(
      runWithOwnerScope(FIRST_OWNER, () => resolveEntityProfileMediaPath(url))
    ).toBeNull();
  });
});
