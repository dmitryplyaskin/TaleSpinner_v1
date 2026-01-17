import path from "path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { initDb } from "./client";

async function main(): Promise<void> {
  const db = await initDb();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  migrate(db, { migrationsFolder });
  console.log(`Migrations applied from: ${migrationsFolder}`);
}

main().catch((error) => {
  console.error("DB migration failed:", error);
  process.exitCode = 1;
});

