import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "../request-context/owner-scope-storage";

import { BaseService } from "./base-service";
import { ConfigService } from "./config-service";

type TestEntity = {
  id: string;
  value: string;
  createdAt: string;
  updatedAt: string;
};

type TestConfig = {
  selectedId: string | null;
};

class TestEntityService extends BaseService<TestEntity> {}

class TestConfigService extends ConfigService<TestConfig> {
  protected getDefaultConfig(): TestConfig {
    return { selectedId: null };
  }
}

let tempDir = "";

describe("owner-aware file services", () => {
  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "owner-files-"));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("isolates BaseService entities while preserving the global legacy path", async () => {
    const service = new TestEntityService("items", { dataDir: tempDir });
    const now = new Date().toISOString();
    await runWithOwnerScope("global", () =>
      service.create({ id: "global-item", value: "global", createdAt: now, updatedAt: now })
    );
    await runWithOwnerScope("owner-a", () =>
      service.create({ id: "private-item", value: "private", createdAt: now, updatedAt: now })
    );

    await expect(
      runWithOwnerScope("global", () => service.getAll())
    ).resolves.toMatchObject([{ id: "global-item" }]);
    await expect(
      runWithOwnerScope("owner-a", () => service.getAll())
    ).resolves.toMatchObject([{ id: "private-item" }]);
    await expect(
      runWithOwnerScope("owner-b", () => service.getAll())
    ).resolves.toEqual([]);

    await expect(
      fs.stat(path.join(tempDir, "global-item.json"))
    ).resolves.toBeTruthy();
    await expect(
      fs.stat(
        path.join(tempDir, "owners", "owner-a", "private-item.json")
      )
    ).resolves.toBeTruthy();
  });

  test("isolates ConfigService values per owner", async () => {
    const service = new TestConfigService("settings.json", {
      dataDir: tempDir,
    });
    await runWithOwnerScope("global", () =>
      service.saveConfig({ selectedId: "global" })
    );
    await runWithOwnerScope("owner-a", () =>
      service.saveConfig({ selectedId: "private" })
    );

    await expect(
      runWithOwnerScope("global", () => service.getConfig())
    ).resolves.toEqual({ selectedId: "global" });
    await expect(
      runWithOwnerScope("owner-a", () => service.getConfig())
    ).resolves.toEqual({ selectedId: "private" });
    await expect(
      runWithOwnerScope("owner-b", () => service.getConfig())
    ).resolves.toEqual({ selectedId: null });
  });

  test("rejects entity ids that could escape the owner directory", async () => {
    const service = new TestEntityService("items", { dataDir: tempDir });
    await expect(
      runWithOwnerScope("owner-a", () =>
        service.getById("../owner-b/private-item")
      )
    ).rejects.toMatchObject({ code: "INVALID_FILENAME" });
  });
});
