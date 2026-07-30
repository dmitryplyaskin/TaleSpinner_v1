import fs from "fs/promises";
import path from "path";

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import { resolveDbPath as resolveDbPathFromEnv } from "../config/path-resolver";

import * as schema from "./schema";

export type Db = BetterSQLite3Database<typeof schema>;
export type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbExecutor = Db | DbTransaction;

let _db: Db | null = null;
let _sqlite: Database.Database | null = null;

export type DbInitOptions = {
  dbPath?: string;
};

export function resolveDbPath(): string {
  return resolveDbPathFromEnv();
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

  _sqlite = sqlite;
  _db = drizzle(sqlite, { schema });
  return _db;
}

export async function withDbTransaction<T>(work: (tx: DbTransaction) => T): Promise<T> {
  const db = await initDb();
  return db.transaction(work);
}

export function resetDbForTests(): void {
  _db = null;
  if (_sqlite) {
    try {
      _sqlite.close();
    } catch {
      // ignore
    }
    _sqlite = null;
  }
}

export async function backupCurrentDatabase(
  destinationPath: string
): Promise<void> {
  if (!_sqlite) {
    throw new Error("Database must be initialized before creating a backup.");
  }
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await _sqlite.backup(destinationPath);
}

export function getCurrentDbPath(): string | null {
  return _sqlite?.name ? path.resolve(_sqlite.name) : null;
}

