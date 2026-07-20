import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";
import { authSessions, users } from "../../db/schema";

describe("auth schema", () => {
  let tempDir = "";

  beforeEach(async () => {
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-auth-schema-"));
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("stores users and hashed session tokens", async () => {
    const db = await initDb();
    const now = new Date();

    await db.insert(users).values({
      id: "user-1",
      username: "Alice",
      normalizedUsername: "alice",
      displayName: "Alice",
      passwordHash: null,
      role: "admin",
      status: "active",
      credentialVersion: 0,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(authSessions).values({
      id: "session-1",
      userId: "user-1",
      tokenHash: "hashed-token",
      csrfTokenHash: "hashed-csrf-token",
      authMethod: "local",
      credentialVersion: 0,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });

    await expect(db.select().from(users)).resolves.toHaveLength(1);
    await expect(db.select().from(authSessions)).resolves.toMatchObject([
      {
        userId: "user-1",
        tokenHash: "hashed-token",
        authMethod: "local",
      },
    ]);
  });

  test("enforces normalized username and token hash uniqueness", async () => {
    const db = await initDb();
    const now = new Date();
    const userValues = {
      username: "Alice",
      normalizedUsername: "alice",
      displayName: "Alice",
      role: "user" as const,
      status: "active" as const,
      credentialVersion: 0,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(users).values({ id: "user-1", ...userValues });
    await expect(
      db.insert(users).values({
        id: "user-2",
        ...userValues,
        username: "ALICE",
      })
    ).rejects.toThrow();

    await db.insert(authSessions).values({
      id: "session-1",
      userId: "user-1",
      tokenHash: "same-hash",
      csrfTokenHash: "csrf-1",
      authMethod: "local",
      credentialVersion: 0,
      createdAt: now,
      lastSeenAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    await expect(
      db.insert(authSessions).values({
        id: "session-2",
        userId: "user-1",
        tokenHash: "same-hash",
        csrfTokenHash: "csrf-2",
        authMethod: "local",
        credentialVersion: 0,
        createdAt: now,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + 60_000),
      })
    ).rejects.toThrow();
  });
});
