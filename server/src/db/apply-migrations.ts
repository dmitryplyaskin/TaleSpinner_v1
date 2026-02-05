import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "path";

import { initDb } from "./client";

export function resolveMigrationsFolder(): string {
  // Resolve relative to server/ so it works regardless of process.cwd().
  return path.join(__dirname, "../../drizzle");
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
      // eslint-disable-next-line no-console
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

  // Drizzle internal API. We intentionally bypass the default migrator so we can
  // sanitize migration chunks and avoid empty-SQL crashes.
  const internal = db as unknown as {
    dialect: { migrate: (m: unknown, s: unknown, c: unknown) => void };
    session: unknown;
  };
  internal.dialect.migrate(migrations, internal.session, { migrationsFolder });
}

