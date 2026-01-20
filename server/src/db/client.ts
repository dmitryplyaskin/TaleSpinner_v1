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
  // Default to server-local data folder (stable regardless of process.cwd()).
  return process.env.DB_PATH ?? path.join(DATA_PATH, "db.sqlite");
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

