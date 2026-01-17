import "dotenv/config";
import path from "path";
import { defineConfig } from "drizzle-kit";

const dbPath =
  process.env.DB_PATH ?? path.join(process.cwd(), "data", "db.sqlite");

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
  verbose: true,
  strict: true,
});

