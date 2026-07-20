import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { resolveAuthConfig } from "../../core/auth/auth-config";
import { applyMigrations } from "../../db/apply-migrations";
import { initDb, resetDbForTests } from "../../db/client";
import { authSessions } from "../../db/schema";

import {
  createAuthSession,
  resolveAuthSession,
  revokeAuthSession,
  verifySessionCsrfToken,
} from "./session-service";
import {
  createUser,
  getUserCredentialsById,
} from "./users-repository";

describe("session service", () => {
  let tempDir = "";
  const config = resolveAuthConfig({});

  beforeEach(async () => {
    resetDbForTests();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "talespinner-session-"));
    await initDb({ dbPath: path.join(tempDir, "db.sqlite") });
    await applyMigrations();
  });

  afterEach(async () => {
    resetDbForTests();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  async function createFixture() {
    await createUser({
      id: "user-1",
      username: "alice",
      displayName: "Alice",
      passwordHash: null,
      role: "admin",
    });
    const user = await getUserCredentialsById("user-1");
    if (!user) throw new Error("Missing fixture user");
    return createAuthSession({ user, authMethod: "local", config });
  }

  test("stores only token hashes and resolves an active principal", async () => {
    const created = await createFixture();
    const db = await initDb();
    const stored = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, created.sessionId));

    expect(stored[0]?.tokenHash).not.toBe(created.token);
    expect(stored[0]?.csrfTokenHash).not.toBe(created.csrfToken);
    await expect(
      resolveAuthSession({ token: created.token, config })
    ).resolves.toMatchObject({
      sessionId: created.sessionId,
      user: { id: "user-1", role: "admin" },
    });
  });

  test("verifies CSRF tokens without storing their plaintext", async () => {
    const created = await createFixture();
    const principal = await resolveAuthSession({
      token: created.token,
      config,
    });
    if (!principal) throw new Error("Missing session principal");

    expect(
      verifySessionCsrfToken(principal, created.csrfToken, config)
    ).toBe(true);
    expect(verifySessionCsrfToken(principal, "wrong-token", config)).toBe(
      false
    );
  });

  test("does not resolve revoked sessions", async () => {
    const created = await createFixture();
    await revokeAuthSession(created.sessionId);

    await expect(
      resolveAuthSession({ token: created.token, config })
    ).resolves.toBeNull();
  });
});
