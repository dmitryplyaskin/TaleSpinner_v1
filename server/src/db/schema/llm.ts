import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { chatMessages, chats, messageVariants } from "./chat-core";

export const llmGenerations = sqliteTable(
  "llm_generations",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    branchId: text("branch_id"),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),
    variantId: text("variant_id").references(() => messageVariants.id, {
      onDelete: "set null",
    }),

    providerId: text("provider_id").notNull(),
    model: text("model").notNull(),
    paramsJson: text("params_json").notNull(),

    status: text("status", { enum: ["streaming", "done", "aborted", "error"] })
      .notNull()
      .default("streaming"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    finishedAt: integer("finished_at", { mode: "timestamp_ms" }),

    promptHash: text("prompt_hash"),
    promptSnapshotJson: text("prompt_snapshot_json"),
    phaseReportJson: text("phase_report_json"),
    commitReportJson: text("commit_report_json"),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    error: text("error"),
  },
  (t) => ({
    chatStartedAtIdx: index("llm_generations_chat_started_at_idx").on(
      t.chatId,
      t.startedAt
    ),
    chatBranchStartedAtIdx: index("llm_generations_chat_branch_started_at_idx").on(
      t.chatId,
      t.branchId,
      t.startedAt
    ),
  })
);

export const llmProviders = sqliteTable("llm_providers", {
  id: text("id").primaryKey(), // openrouter | openai_compatible
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

