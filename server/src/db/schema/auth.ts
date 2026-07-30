import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    normalizedUsername: text("normalized_username").notNull(),
    displayName: text("display_name").notNull(),
    passwordHash: text("password_hash"),
    role: text("role", { enum: ["admin", "user"] }).notNull().default("user"),
    status: text("status", { enum: ["active", "disabled"] })
      .notNull()
      .default("active"),
    credentialVersion: integer("credential_version").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    normalizedUsernameUnique: uniqueIndex("users_normalized_username_uq").on(
      table.normalizedUsername
    ),
    statusUpdatedAtIndex: index("users_status_updated_at_idx").on(
      table.status,
      table.updatedAt
    ),
  })
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    csrfTokenHash: text("csrf_token_hash").notNull(),
    authMethod: text("auth_method", { enum: ["local", "password"] }).notNull(),
    credentialVersion: integer("credential_version").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    lastSeenAt: integer("last_seen_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  },
  (table) => ({
    tokenHashUnique: uniqueIndex("auth_sessions_token_hash_uq").on(
      table.tokenHash
    ),
    userExpiresAtIndex: index("auth_sessions_user_expires_at_idx").on(
      table.userId,
      table.expiresAt
    ),
    expiresAtIndex: index("auth_sessions_expires_at_idx").on(table.expiresAt),
  })
);
