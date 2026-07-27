import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "path";

import { sql } from "drizzle-orm";

import {
  backupCurrentDatabase,
  getCurrentDbPath,
  initDb,
} from "./client";

export function resolveMigrationsFolder(): string {
  const cwdPath = path.resolve(process.cwd(), "drizzle");
  if (fs.existsSync(path.join(cwdPath, "meta", "_journal.json"))) {
    return cwdPath;
  }

  // ts-node/dev fallback when started from nested working directories.
  const sourceRelativePath = path.resolve(__dirname, "../../drizzle");
  if (fs.existsSync(path.join(sourceRelativePath, "meta", "_journal.json"))) {
    return sourceRelativePath;
  }

  // dist fallback when compiled output is nested under dist/server/src.
  return path.resolve(__dirname, "../../../../drizzle");
}

type Journal = {
  entries: Array<{
    tag: string;
    breakpoints: boolean;
    when: number;
  }>;
};

/**
 * Drizzle's built-in migrator does not skip empty chunks after splitting by
 * `"--> statement-breakpoint"`. When a migration file is temporarily empty
 * (e.g. during editor save / nodemon restart) or contains an accidental extra
 * breakpoint, SQLite throws:
 * `RangeError: The supplied SQL string contains no statements`.
 *
 * We defensively filter empty chunks so server boot doesn't crash.
 */
function readMigrationFilesSafe(migrationsFolder: string): Array<{
  sql: string[];
  bps: boolean;
  folderMillis: number;
  hash: string;
}> {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) {
    throw new Error(`Can't find meta/_journal.json file at ${journalPath}`);
  }

  const journal = JSON.parse(
    fs.readFileSync(journalPath, "utf8")
  ) as Journal;

  return journal.entries.map((entry) => {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const query = fs.readFileSync(migrationPath, "utf8");

    const partsRaw = query.split("--> statement-breakpoint");
    const parts = partsRaw.map((p) => p.trim()).filter((p) => p.length > 0);

    if (parts.length !== partsRaw.length) {
      const removed = partsRaw.length - parts.length;
       
      console.warn(
        `[db] migration '${entry.tag}': ignored ${removed} empty SQL chunk(s)`
      );
    }

    return {
      sql: parts,
      bps: entry.breakpoints,
      folderMillis: entry.when,
      hash: createHash("sha256").update(query).digest("hex"),
    };
  });
}

/**
 * Applies all pending Drizzle migrations.
 *
 * Safe to call on every server start: Drizzle tracks applied migrations in
 * `__drizzle_migrations`.
 */
export async function applyMigrations(): Promise<void> {
  const db = await initDb();
  const migrationsFolder = resolveMigrationsFolder();
  const migrations = readMigrationFilesSafe(migrationsFolder);
  const tables = await db.all<{ name: string }>(
    sql`SELECT name FROM sqlite_master WHERE type = 'table'`
  );
  const tableNames = new Set(tables.map((table) => table.name));
  if (
    tableNames.has("__drizzle_migrations") &&
    !tableNames.has("users")
  ) {
    const dbPath = getCurrentDbPath();
    if (!dbPath) {
      throw new Error("Unable to resolve database path for migration backup.");
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(
      path.dirname(dbPath),
      "backups",
      `db-pre-user-accounts-${timestamp}.sqlite`
    );
    await backupCurrentDatabase(backupPath);
    console.info("[db] created pre-user-accounts migration backup", {
      backupPath,
    });
  }

  // Drizzle internal API. We intentionally bypass the default migrator so we can
  // sanitize migration chunks and avoid empty-SQL crashes.
  const internal = db as unknown as {
    dialect: { migrate: (m: unknown, s: unknown, c: unknown) => void };
    session: unknown;
  };
  internal.dialect.migrate(migrations, internal.session, { migrationsFolder });
}

