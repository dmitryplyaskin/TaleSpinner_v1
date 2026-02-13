import fs from "fs/promises";
import path from "path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { DATA_PATH } from "../const";
import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;

let _db: Db | null = null;

export type DbInitOptions = {
  dbPath?: string;
};

export function resolveDbPath(): string {
  const configured = process.env.DB_PATH?.trim();
  if (!configured) {
    // Default to server-local data folder (stable regardless of process.cwd()).
    return path.join(DATA_PATH, "db.sqlite");
  }

  if (path.isAbsolute(configured)) {
    return configured;
  }

  // Resolve relative DB_PATH against server root, not process.cwd().
  const serverRoot = path.resolve(__dirname, "../..");
  return path.resolve(serverRoot, configured);
}

export async function initDb(options: DbInitOptions = {}): Promise<Db> {
  if (_db) {
    return _db;
  }

  const dbPath = options.dbPath ?? resolveDbPath();
  await fs.mkdir(path.dirname(dbPath), { recursive: true });

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  _db = drizzle(sqlite, { schema });
  return _db;
}

