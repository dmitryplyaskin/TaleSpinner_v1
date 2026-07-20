import { randomUUID } from "node:crypto";

import { asc, eq } from "drizzle-orm";

import { initDb } from "../../db/client";
import { users } from "../../db/schema";

export type UserRole = "admin" | "user";
export type UserStatus = "active" | "disabled";

export type UserDto = {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  hasPassword: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
};

export type UserCredentials = UserDto & {
  normalizedUsername: string;
  passwordHash: string | null;
  credentialVersion: number;
};

function normalizeIdentity(value: string): string {
  return value.normalize("NFKC").trim();
}

export function normalizeUsername(value: string): string {
  return normalizeIdentity(value).toLocaleLowerCase("en-US");
}

function validateIdentity(username: string, displayName: string): void {
  if (username.length < 1 || username.length > 64) {
    throw new Error("Username must contain between 1 and 64 characters.");
  }
  if (displayName.length < 1 || displayName.length > 128) {
    throw new Error("Display name must contain between 1 and 128 characters.");
  }
}

function rowToDto(row: typeof users.$inferSelect): UserDto {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    role: row.role,
    status: row.status,
    hasPassword: Boolean(row.passwordHash),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lastLoginAt: row.lastLoginAt,
  };
}

function rowToCredentials(
  row: typeof users.$inferSelect
): UserCredentials {
  return {
    ...rowToDto(row),
    normalizedUsername: row.normalizedUsername,
    passwordHash: row.passwordHash,
    credentialVersion: row.credentialVersion,
  };
}

export async function countUsers(): Promise<number> {
  const db = await initDb();
  const rows = await db.select({ id: users.id }).from(users);
  return rows.length;
}

export async function createUser(params: {
  id?: string;
  username: string;
  displayName: string;
  passwordHash: string | null;
  role: UserRole;
  status?: UserStatus;
}): Promise<UserDto> {
  const db = await initDb();
  const username = normalizeIdentity(params.username);
  const displayName = normalizeIdentity(params.displayName);
  validateIdentity(username, displayName);
  const now = new Date();
  const id = params.id ?? randomUUID();

  await db.insert(users).values({
    id,
    username,
    normalizedUsername: normalizeUsername(username),
    displayName,
    passwordHash: params.passwordHash,
    role: params.role,
    status: params.status ?? "active",
    credentialVersion: 0,
    createdAt: now,
    updatedAt: now,
  });

  const created = await getUserById(id);
  if (!created) throw new Error("Created user could not be loaded.");
  return created;
}

export async function createInitialUser(params: {
  username: string;
  displayName: string;
  passwordHash: string | null;
}): Promise<UserDto | null> {
  const db = await initDb();
  const username = normalizeIdentity(params.username);
  const displayName = normalizeIdentity(params.displayName);
  validateIdentity(username, displayName);
  const now = new Date();

  return db.transaction((tx) => {
    const existing = tx.select({ id: users.id }).from(users).limit(1).all();
    if (existing.length > 0) return null;

    tx.insert(users)
      .values({
        id: "global",
        username,
        normalizedUsername: normalizeUsername(username),
        displayName,
        passwordHash: params.passwordHash,
        role: "admin",
        status: "active",
        credentialVersion: 0,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    return {
      id: "global",
      username,
      displayName,
      role: "admin",
      status: "active",
      hasPassword: Boolean(params.passwordHash),
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null,
    };
  });
}

export async function getUserById(id: string): Promise<UserDto | null> {
  const db = await initDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? rowToDto(rows[0]) : null;
}

export async function getUserCredentialsById(
  id: string
): Promise<UserCredentials | null> {
  const db = await initDb();
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ? rowToCredentials(rows[0]) : null;
}

export async function getUserCredentialsByUsername(
  username: string
): Promise<UserCredentials | null> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.normalizedUsername, normalizeUsername(username)))
    .limit(1);
  return rows[0] ? rowToCredentials(rows[0]) : null;
}

export async function listActiveUsers(): Promise<UserDto[]> {
  const db = await initDb();
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.status, "active"))
    .orderBy(asc(users.username));
  return rows.map(rowToDto);
}

export async function listUsers(): Promise<UserDto[]> {
  const db = await initDb();
  const rows = await db.select().from(users).orderBy(asc(users.username));
  return rows.map(rowToDto);
}

export async function recordUserLogin(id: string): Promise<void> {
  const db = await initDb();
  const now = new Date();
  await db
    .update(users)
    .set({ lastLoginAt: now, updatedAt: now })
    .where(eq(users.id, id));
}
