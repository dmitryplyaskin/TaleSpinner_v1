import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { applyMigrations, resolveMigrationsFolder } from "./apply-migrations";
import { initDb, resetDbForTests } from "./client";

type MigrationJournal = {
  entries: Array<{ tag: string; when: number }>;
};

async function createLegacyDatabase(dbPath: string): Promise<void> {
  const migrationsFolder = resolveMigrationsFolder();
  const journal = JSON.parse(
    await fs.readFile(
      path.join(migrationsFolder, "meta", "_journal.json"),
      "utf8"
    )
  ) as MigrationJournal;
  const sqlite = new Database(dbPath);
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
    CREATE TABLE __drizzle_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  for (const entry of journal.entries.filter(
    (item) => item.tag !== "0032_user_accounts"
  )) {
    const query = await fs.readFile(
      path.join(migrationsFolder, `${entry.tag}.sql`),
      "utf8"
    );
    sqlite.exec(query);
    sqlite
      .prepare(
        "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)"
      )
      .run(createHash("sha256").update(query).digest("hex"), entry.when);
  }

  const now = Date.now();
  sqlite
    .prepare(
      "INSERT INTO llm_providers (id, name, enabled, created_at, updated_at) VALUES (?, ?, 1, ?, ?)"
    )
    .run("provider-1", "Provider", now, now);
  sqlite
    .prepare(
      "INSERT INTO llm_provider_configs (id, provider_id, config_json, created_at, updated_at) VALUES (?, ?, '{}', ?, ?)"
    )
    .run("config-1", "provider-1", now, now);
  sqlite
    .prepare(
      "INSERT INTO llm_tokens (id, provider_id, name, ciphertext, token_hint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .run("token-1", "provider-1", "Legacy", "encrypted", "***", now, now);
  sqlite
    .prepare(
      "INSERT INTO llm_runtime_settings (scope, scope_id, active_provider_id, active_token_id, updated_at) VALUES ('global', 'global', ?, ?, ?)"
    )
    .run("provider-1", "token-1", now);
  sqlite
    .prepare(
      "INSERT INTO ui_app_backgrounds (id, name, file_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
    )
    .run("background-1", "Legacy", "legacy.png", now, now);
  sqlite.close();
}

describe("user accounts migration", () => {
  let tempDir = "";

  beforeEach(async () => {
    resetDbForTests();
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "user-accounts-migration-")
    );
  });

  afterEach(async () => {
    resetDbForTests();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("backs up and adopts legacy global data before upgrading", async () => {
    const dbPath = path.join(tempDir, "db.sqlite");
    await createLegacyDatabase(dbPath);
    await initDb({ dbPath });
    await applyMigrations();

    const backupsDir = path.join(tempDir, "backups");
    const backups = (await fs.readdir(backupsDir)).filter((name) =>
      name.endsWith(".sqlite")
    );
    expect(backups).toHaveLength(1);

    const backup = new Database(path.join(backupsDir, backups[0]), {
      readonly: true,
    });
    expect(
      backup
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
        )
        .get()
    ).toBeUndefined();
    expect(
      backup.prepare("SELECT id FROM llm_tokens WHERE id='token-1'").get()
    ).toEqual({ id: "token-1" });
    backup.close();

    const upgraded = new Database(dbPath, { readonly: true });
    expect(
      upgraded
        .prepare("SELECT owner_id FROM llm_tokens WHERE id='token-1'")
        .get()
    ).toEqual({ owner_id: "global" });
    expect(
      upgraded
        .prepare(
          "SELECT owner_id FROM ui_app_backgrounds WHERE id='background-1'"
        )
        .get()
    ).toEqual({ owner_id: "global" });
    expect(
      upgraded
        .prepare(
          "SELECT scope_id FROM llm_runtime_settings WHERE scope='global'"
        )
        .get()
    ).toEqual({ scope_id: "global:global" });
    upgraded.close();

    await applyMigrations();
    const finalBackups = (await fs.readdir(backupsDir)).filter((name) =>
      name.endsWith(".sqlite")
    );
    expect(finalBackups).toHaveLength(1);
  });
});
