import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "../core/request-context/owner-scope-storage";
import { applyMigrations } from "../db/apply-migrations";
import { initDb, resetDbForTests } from "../db/client";
import {
  createTempDataDir,
  removeTempDataDir,
} from "../e2e/helpers/tmp-dir";

import { ensureRagPresetState, ragService } from "./rag.service";

let tempDir = "";

describe("RAG owner isolation", () => {
  beforeEach(async () => {
    resetDbForTests();
    tempDir = await createTempDataDir("rag-owner-");
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    await removeTempDataDir(tempDir);
  });

  test("isolates runtime, provider configs, presets, and selected preset", async () => {
    const firstState = await runWithOwnerScope("owner-a", async () => {
      await ragService.runtime.saveConfig({
        activeProviderId: "ollama",
        activeTokenId: null,
        activeModel: "embed-a",
        activeTokenHint: null,
      });
      await ragService.providerConfigs.saveConfig({
        openrouter: { defaultModel: "openrouter-a" },
        ollama: { baseUrl: "http://owner-a:11434" },
      });
      return ensureRagPresetState();
    });

    await runWithOwnerScope("owner-b", async () => {
      expect(await ragService.runtime.getConfig()).toMatchObject({
        activeProviderId: "openrouter",
        activeTokenId: null,
        activeModel: null,
      });
      expect(await ragService.providerConfigs.getConfig()).toMatchObject({
        openrouter: { defaultModel: "text-embedding-3-small" },
        ollama: { baseUrl: "http://localhost:11434" },
      });
      const secondState = await ensureRagPresetState();
      expect(secondState.presets).toHaveLength(1);
      expect(secondState.presets[0]?.id).not.toBe(firstState.presets[0]?.id);
    });

    await runWithOwnerScope("owner-a", async () => {
      expect(await ragService.runtime.getConfig()).toMatchObject({
        activeProviderId: "ollama",
        activeModel: "embed-a",
      });
      expect(await ragService.providerConfigs.getConfig()).toMatchObject({
        openrouter: { defaultModel: "openrouter-a" },
        ollama: { baseUrl: "http://owner-a:11434" },
      });
      const restoredState = await ensureRagPresetState();
      expect(restoredState.presets[0]?.id).toBe(firstState.presets[0]?.id);
      expect(restoredState.settings.selectedId).toBe(
        firstState.settings.selectedId
      );
    });
  });

  test("cannot overwrite another owner's preset by reusing its id", async () => {
    const preset = {
      id: "shared-preset-id",
      name: "Owner A preset",
      payload: {
        activeProviderId: "ollama" as const,
        activeTokenId: null,
        activeModel: "model-a",
        providerConfigsById: {},
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await runWithOwnerScope("owner-a", () =>
      ragService.presets.create(preset)
    );

    await expect(
      runWithOwnerScope("owner-b", () =>
        ragService.presets.create({ ...preset, name: "Owner B overwrite" })
      )
    ).rejects.toThrow();
    await expect(
      runWithOwnerScope("owner-a", () => ragService.presets.getAll())
    ).resolves.toEqual([
      expect.objectContaining({ id: preset.id, name: "Owner A preset" }),
    ]);
  });
});
