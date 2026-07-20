import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";

import {
  countUsers,
  createUser,
  getUserCredentialsByUsername,
  listActiveUsers,
  normalizeUsername,
} from "./users-repository";

describe("users repository", () => {
  let tempDir = "";

  beforeEach(async () => {
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-users-"));
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("creates safe user DTOs and keeps credentials internal", async () => {
    const user = await createUser({
      id: "global",
      username: " Alice ",
      displayName: "Alice",
      passwordHash: "secret-hash",
      role: "admin",
    });

    expect(user).toMatchObject({
      id: "global",
      username: "Alice",
      displayName: "Alice",
      role: "admin",
      status: "active",
      hasPassword: true,
    });
    expect(user).not.toHaveProperty("passwordHash");
    await expect(countUsers()).resolves.toBe(1);

    await expect(
      getUserCredentialsByUsername("ALICE")
    ).resolves.toMatchObject({
      id: "global",
      normalizedUsername: "alice",
      passwordHash: "secret-hash",
    });
  });

  test("normalizes Unicode usernames and enforces uniqueness", async () => {
    expect(normalizeUsername("  Ａlice  ")).toBe("alice");

    await createUser({
      username: "Alice",
      displayName: "Alice",
      passwordHash: null,
      role: "user",
    });
    await expect(
      createUser({
        username: "ＡLICE",
        displayName: "Other Alice",
        passwordHash: null,
        role: "user",
      })
    ).rejects.toThrow();
  });

  test("lists only active users for local account selection", async () => {
    await createUser({
      id: "active-user",
      username: "active",
      displayName: "Active",
      passwordHash: null,
      role: "user",
    });
    await createUser({
      id: "disabled-user",
      username: "disabled",
      displayName: "Disabled",
      passwordHash: null,
      role: "user",
      status: "disabled",
    });

    await expect(listActiveUsers()).resolves.toMatchObject([
      { id: "active-user" },
    ]);
  });
});
