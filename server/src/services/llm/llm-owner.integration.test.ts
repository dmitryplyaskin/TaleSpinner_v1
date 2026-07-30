import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { runWithOwnerScope } from "../../core/request-context/owner-scope-storage";
import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";
import {
  createTempDataDir,
  removeTempDataDir,
} from "../../e2e/helpers/tmp-dir";

import {
  createToken,
  deleteToken,
  ensureDefaultProviders,
  getProviderConfig,
  getRuntime,
  getTokenPlaintext,
  listTokens,
  upsertProviderConfig,
  upsertRuntime,
} from "./llm-repository";

let tempDir = "";
let previousMasterKey: string | undefined;

describe("LLM owner isolation", () => {
  beforeEach(async () => {
    previousMasterKey = process.env.TOKENS_MASTER_KEY;
    process.env.TOKENS_MASTER_KEY = "test-only-master-key";
    resetDbForTests();
    tempDir = await createTempDataDir("llm-owner-");
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
    await ensureDefaultProviders();
  });

  afterEach(async () => {
    resetDbForTests();
    await removeTempDataDir(tempDir);
    if (previousMasterKey === undefined) {
      delete process.env.TOKENS_MASTER_KEY;
    } else {
      process.env.TOKENS_MASTER_KEY = previousMasterKey;
    }
  });

  test("isolates tokens, provider config, and runtime state", async () => {
    const firstToken = await runWithOwnerScope("owner-a", async () => {
      const token = await createToken({
        providerId: "openrouter",
        name: "first",
        token: "sk-owner-a-secret",
      });
      await upsertProviderConfig("openrouter", { baseUrl: "https://owner-a" });
      await upsertRuntime({
        scope: "global",
        scopeId: "global",
        activeProviderId: "openrouter",
        activeTokenId: token.id,
        activeModel: "model-a",
      });
      return token;
    });

    await runWithOwnerScope("owner-b", async () => {
      expect(await listTokens("openrouter")).toEqual([]);
      expect(await getTokenPlaintext(firstToken.id)).toBeNull();
      expect(await getProviderConfig("openrouter")).toEqual({
        providerId: "openrouter",
        config: {},
      });
      expect(await getRuntime("global", "global")).toMatchObject({
        activeTokenId: null,
        activeModel: null,
      });

      await deleteToken(firstToken.id);
      await upsertProviderConfig("openrouter", { baseUrl: "https://owner-b" });
    });

    await runWithOwnerScope("owner-a", async () => {
      expect(await listTokens("openrouter")).toHaveLength(1);
      expect(await getTokenPlaintext(firstToken.id)).toBe("sk-owner-a-secret");
      expect(await getProviderConfig("openrouter")).toEqual({
        providerId: "openrouter",
        config: { baseUrl: "https://owner-a" },
      });
      expect(await getRuntime("global", "global")).toMatchObject({
        activeTokenId: firstToken.id,
        activeModel: "model-a",
      });
    });
  });
});
