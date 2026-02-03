import path from "path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { initDb } from "./client";

export function resolveMigrationsFolder(): string {
  // Resolve relative to server/ so it works regardless of process.cwd().
  return path.join(__dirname, "../../drizzle");
}

/**
 * Applies all pending Drizzle migrations.
 *
 * Safe to call on every server start: Drizzle tracks applied migrations in
 * `__drizzle_migrations`.
 */
export async function applyMigrations(): Promise<void> {
  const db = await initDb();
  migrate(db, { migrationsFolder: resolveMigrationsFolder() });
}

