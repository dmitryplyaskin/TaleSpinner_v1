import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "@core/request-context/owner-scope-storage";

import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";

import {
  deleteAppBackground,
  getAppBackgroundCatalog,
  importAppBackground,
} from "./app-backgrounds-repository";

const FIRST_OWNER = "11111111-1111-4111-8111-111111111111";
const SECOND_OWNER = "22222222-2222-4222-8222-222222222222";

describe("app background owner scope", () => {
  let tempDir = "";
  let previousDataDir: string | undefined;

  beforeEach(async () => {
    resetDbForTests();
    previousDataDir = process.env.DATA_DIR;
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "app-background-owner-"));
    process.env.DATA_DIR = tempDir;
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("isolates uploaded backgrounds and their files by active owner", async () => {
    const uploaded = await runWithOwnerScope(FIRST_OWNER, () =>
      importAppBackground({
        fileBuffer: Buffer.from("owner-a"),
        originalName: "private.png",
      })
    );

    expect(uploaded.imageUrl).toContain(
      `/app-backgrounds/${FIRST_OWNER}/`
    );
    await expect(
      runWithOwnerScope(SECOND_OWNER, () => getAppBackgroundCatalog())
    ).resolves.not.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ id: uploaded.id })]),
    });
    await expect(
      runWithOwnerScope(SECOND_OWNER, () =>
        deleteAppBackground({ id: uploaded.id })
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const ownerCatalog = await runWithOwnerScope(FIRST_OWNER, () =>
      getAppBackgroundCatalog()
    );
    expect(ownerCatalog.items).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: uploaded.id })])
    );

    const storedPath = path.join(
      tempDir,
      "media",
      "images",
      "app-backgrounds",
      FIRST_OWNER,
      path.basename(uploaded.imageUrl)
    );
    await expect(fs.readFile(storedPath, "utf8")).resolves.toBe("owner-a");
  });
});
