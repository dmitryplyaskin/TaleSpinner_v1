import "dotenv/config";

import { applyMigrations, resolveMigrationsFolder } from "./apply-migrations";

async function main(): Promise<void> {
  await applyMigrations();
  console.log(`Migrations applied from: ${resolveMigrationsFolder()}`);
}

main().catch((error) => {
  console.error("DB migration failed:", error);
  process.exitCode = 1;
});

