import {
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

import { and, eq, isNotNull, isNull, lte, or } from "drizzle-orm";

import { initDb } from "../../db/client";
import { authSessions } from "../../db/schema";

import {
  getUserCredentialsById,
  type UserCredentials,
  type UserDto,
} from "./users-repository";

import type { AuthConfig } from "../../core/auth/auth-config";

export type AuthMethod = "local" | "password";

export type SessionPrincipal = {
  sessionId: string;
  user: UserDto;
  csrfTokenHash: string;
  expiresAt: Date;
};

export type CreatedAuthSession = {
  sessionId: string;
  token: string;
  csrfToken: string;
  expiresAt: Date;
};

function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string, secret: string | null): string {
  return secret
    ? createHmac("sha256", secret).update(token).digest("hex")
    : createHash("sha256").update(token).digest("hex");
}

function deriveCsrfToken(params: {
  sessionId: string;
  tokenHash: string;
  secret: string | null;
}): string {
  return createHmac("sha256", params.secret ?? params.tokenHash)
    .update(`csrf:${params.sessionId}:${params.tokenHash}`)
    .digest("base64url");
}

function safeUser(credentials: UserCredentials): UserDto {
  const {
    normalizedUsername: _normalizedUsername,
    passwordHash: _passwordHash,
    credentialVersion: _credentialVersion,
    ...user
  } = credentials;
  return user;
}

export async function createAuthSession(params: {
  user: UserCredentials;
  authMethod: AuthMethod;
  config: AuthConfig;
}): Promise<CreatedAuthSession> {
  const db = await initDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + params.config.sessionTtlMs);
  const token = generateToken();
  const sessionId = randomUUID();
  const tokenHash = hashToken(token, params.config.sessionSecret);
  const csrfToken = deriveCsrfToken({
    sessionId,
    tokenHash,
    secret: params.config.sessionSecret,
  });

  await db.insert(authSessions).values({
    id: sessionId,
    userId: params.user.id,
    tokenHash,
    csrfTokenHash: hashToken(csrfToken, params.config.sessionSecret),
    authMethod: params.authMethod,
    credentialVersion: params.user.credentialVersion,
    createdAt: now,
    lastSeenAt: now,
    expiresAt,
  });

  return { sessionId, token, csrfToken, expiresAt };
}

export async function resolveAuthSession(params: {
  token: string;
  config: AuthConfig;
}): Promise<SessionPrincipal | null> {
  const db = await initDb();
  const tokenHash = hashToken(params.token, params.config.sessionSecret);
  const rows = await db
    .select()
    .from(authSessions)
    .where(
      and(
        eq(authSessions.tokenHash, tokenHash),
        isNull(authSessions.revokedAt)
      )
    )
    .limit(1);
  const session = rows[0];
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;

  const user = await getUserCredentialsById(session.userId);
  if (
    !user ||
    user.status !== "active" ||
    user.credentialVersion !== session.credentialVersion
  ) {
    return null;
  }

  await db
    .update(authSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(authSessions.id, session.id));

  return {
    sessionId: session.id,
    user: safeUser(user),
    csrfTokenHash: session.csrfTokenHash,
    expiresAt: session.expiresAt,
  };
}

export function verifySessionCsrfToken(
  principal: SessionPrincipal,
  csrfToken: string,
  config: AuthConfig
): boolean {
  const actual = Buffer.from(
    hashToken(csrfToken, config.sessionSecret),
    "hex"
  );
  const expected = Buffer.from(principal.csrfTokenHash, "hex");
  return (
    actual.length === expected.length && timingSafeEqual(actual, expected)
  );
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  const db = await initDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.id, sessionId));
}

export async function revokeUserSessions(userId: string): Promise<void> {
  const db = await initDb();
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt))
    );
}

export async function rotateSessionCsrfToken(
  sessionId: string,
  config: AuthConfig
): Promise<string> {
  const db = await initDb();
  const rows = await db
    .select({
      tokenHash: authSessions.tokenHash,
    })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, sessionId),
        isNull(authSessions.revokedAt)
      )
    )
    .limit(1);
  const session = rows[0];
  if (!session) {
    throw new Error("Active authentication session not found.");
  }
  const csrfToken = deriveCsrfToken({
    sessionId,
    tokenHash: session.tokenHash,
    secret: config.sessionSecret,
  });
  await db
    .update(authSessions)
    .set({
      csrfTokenHash: hashToken(csrfToken, config.sessionSecret),
      lastSeenAt: new Date(),
    })
    .where(eq(authSessions.id, sessionId));
  return csrfToken;
}

export async function cleanupAuthSessions(params?: {
  now?: Date;
  revokedRetentionMs?: number;
}): Promise<number> {
  const db = await initDb();
  const now = params?.now ?? new Date();
  const revokedCutoff = new Date(
    now.getTime() - (params?.revokedRetentionMs ?? 7 * 24 * 60 * 60 * 1000)
  );
  const result = await db
    .delete(authSessions)
    .where(
      or(
        lte(authSessions.expiresAt, now),
        and(
          isNotNull(authSessions.revokedAt),
          lte(authSessions.revokedAt, revokedCutoff)
        )
      )
    );
  return result.changes;
}
