import path from "node:path";

import Database from "better-sqlite3";

export class TestDb {
  private readonly db: Database.Database;

  constructor(dataDir: string) {
    this.db = new Database(path.join(dataDir, "db.sqlite"), { readonly: true });
  }

  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): T | undefined {
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      return stmt.get(...params) as T | undefined;
    }
    return stmt.get() as T | undefined;
  }

  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): T[] {
    const stmt = this.db.prepare(sql);
    if (params && params.length > 0) {
      return stmt.all(...params) as T[];
    }
    return stmt.all() as T[];
  }

  close(): void {
    this.db.close();
  }
}
