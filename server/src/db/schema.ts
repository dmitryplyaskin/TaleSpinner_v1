import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
  content: text("content").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp_ms" }).notNull(),
});

export const llmProviders = sqliteTable("llm_providers", {
  id: text("id").primaryKey(), // openrouter | custom_openai
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const llmProviderConfigs = sqliteTable("llm_provider_configs", {
  id: text("id").primaryKey(),
  providerId: text("provider_id")
    .notNull()
    .references(() => llmProviders.id, { onDelete: "cascade" }),
  // Provider-specific fields are stored in JSON to avoid schema churn.
  configJson: text("config_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const llmTokens = sqliteTable("llm_tokens", {
  id: text("id").primaryKey(),
  providerId: text("provider_id")
    .notNull()
    .references(() => llmProviders.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  ciphertext: text("ciphertext").notNull(),
  tokenHint: text("token_hint").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
});

export const llmRuntimeSettings = sqliteTable(
  "llm_runtime_settings",
  {
    scope: text("scope", { enum: ["global", "agent"] }).notNull(),
    scopeId: text("scope_id").notNull(),
    activeProviderId: text("active_provider_id")
      .notNull()
      .references(() => llmProviders.id),
    activeTokenId: text("active_token_id").references(() => llmTokens.id),
    activeModel: text("active_model"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    scopeScopeIdUnique: uniqueIndex("llm_runtime_scope_scope_id_uq").on(
      t.scope,
      t.scopeId
    ),
  })
);

export const llmRuntimeProviderState = sqliteTable(
  "llm_runtime_provider_state",
  {
    scope: text("scope", { enum: ["global", "agent"] }).notNull(),
    scopeId: text("scope_id").notNull(),
    providerId: text("provider_id")
      .notNull()
      .references(() => llmProviders.id, { onDelete: "cascade" }),
    lastTokenId: text("last_token_id").references(() => llmTokens.id),
    lastModel: text("last_model"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    scopeScopeIdProviderUnique: uniqueIndex(
      "llm_runtime_provider_state_scope_scope_id_provider_uq"
    ).on(t.scope, t.scopeId, t.providerId),
  })
);

