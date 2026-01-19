import path from "path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { initDb } from "./client";

export function resolveMigrationsFolder(): string {
  return path.join(process.cwd(), "drizzle");
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

