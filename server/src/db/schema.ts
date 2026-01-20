import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Chat Core v1 (docs/chat-core-spec.md)
 *
 * Notes:
 * - `owner_id` is a single-user / future multi-tenant hook. In v1 default is "global".
 * - Some optional cross-FKs are intentionally omitted to avoid cyclic deps at schema-definition time
 *   (e.g. chats.active_branch_id -> chat_branches.id). They can be enforced at app level.
 */

export const entityProfiles = sqliteTable(
  "entity_profiles",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    name: text("name").notNull(),
    kind: text("kind", { enum: ["CharSpec"] }).notNull().default("CharSpec"),
    specJson: text("spec_json").notNull(),
    metaJson: text("meta_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    avatarAssetId: text("avatar_asset_id"),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("entity_profiles_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
  })
);

export const chats = sqliteTable(
  "chats",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    entityProfileId: text("entity_profile_id")
      .notNull()
      .references(() => entityProfiles.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    activeBranchId: text("active_branch_id"),
    status: text("status", { enum: ["active", "archived", "deleted"] })
      .notNull()
      .default("active"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    lastMessageAt: integer("last_message_at", { mode: "timestamp_ms" }),
    lastMessagePreview: text("last_message_preview"),
    version: integer("version").notNull().default(0),
    metaJson: text("meta_json"),

    // Origin fields for future “fork to new chat”
    originChatId: text("origin_chat_id"),
    originBranchId: text("origin_branch_id"),
    originMessageId: text("origin_message_id"),
  },
  (t) => ({
    entityProfileUpdatedAtIdx: index("chats_entity_profile_updated_at_idx").on(
      t.entityProfileId,
      t.updatedAt
    ),
    ownerUpdatedAtIdx: index("chats_owner_updated_at_idx").on(t.ownerId, t.updatedAt),
  })
);

export const chatBranches = sqliteTable(
  "chat_branches",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),

    title: text("title"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),

    parentBranchId: text("parent_branch_id"),
    forkedFromMessageId: text("forked_from_message_id"),
    forkedFromVariantId: text("forked_from_variant_id"),
    metaJson: text("meta_json"),
  },
  (t) => ({
    chatCreatedAtIdx: index("chat_branches_chat_created_at_idx").on(
      t.chatId,
      t.createdAt
    ),
  })
);

export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => chatBranches.id, { onDelete: "cascade" }),

    role: text("role", { enum: ["user", "assistant", "system"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),

    promptText: text("prompt_text").notNull().default(""),
    format: text("format"),
    blocksJson: text("blocks_json").notNull().default("[]"),
    metaJson: text("meta_json"),

    // If variants are enabled, this points to selected variant; prompt_text is a cache of selected.
    activeVariantId: text("active_variant_id"),
  },
  (t) => ({
    chatBranchCreatedAtIdx: index("chat_messages_chat_branch_created_at_idx").on(
      t.chatId,
      t.branchId,
      t.createdAt
    ),
  })
);

export const messageVariants = sqliteTable(
  "message_variants",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    messageId: text("message_id")
      .notNull()
      .references(() => chatMessages.id, { onDelete: "cascade" }),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    kind: text("kind", { enum: ["generation", "manual_edit", "import"] }).notNull(),
    promptText: text("prompt_text").notNull().default(""),
    blocksJson: text("blocks_json").notNull().default("[]"),
    metaJson: text("meta_json"),
    isSelected: integer("is_selected", { mode: "boolean" })
      .notNull()
      .default(false),
  },
  (t) => ({
    messageCreatedAtIdx: index("message_variants_message_created_at_idx").on(
      t.messageId,
      t.createdAt
    ),
  })
);

export const promptTemplates = sqliteTable(
  "prompt_templates",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),

    name: text("name").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    scope: text("scope", { enum: ["global", "entity_profile", "chat"] }).notNull(),
    scopeId: text("scope_id"),
    engine: text("engine").notNull().default("liquidjs"),
    templateText: text("template_text").notNull(),
    metaJson: text("meta_json"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    scopeScopeIdEnabledIdx: index("prompt_templates_scope_scope_id_enabled_idx").on(
      t.scope,
      t.scopeId,
      t.enabled
    ),
  })
);

export const pipelines = sqliteTable("pipelines", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("global"),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  definitionJson: text("definition_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("global"),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  entityProfileId: text("entity_profile_id")
    .notNull()
    .references(() => entityProfiles.id, { onDelete: "cascade" }),
  // Stable idempotency key for dedup (v1). Null when not used.
  idempotencyKey: text("idempotency_key"),
  trigger: text("trigger", {
    enum: ["user_message", "regenerate", "manual", "scheduled", "api"],
  })
    .notNull()
    .default("user_message"),
  status: text("status", { enum: ["running", "done", "error", "aborted"] })
    .notNull()
    .default("running"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),

  // Correlation ids / recovery helpers (v1)
  branchId: text("branch_id"),
  userMessageId: text("user_message_id"),
  assistantMessageId: text("assistant_message_id"),
  assistantVariantId: text("assistant_variant_id"),
  generationId: text("generation_id"),

  // Reserved for Phase 3 (PipelineProfile selection); stored for reproducibility/debug.
  activeProfileId: text("active_profile_id"),
  activeProfileVersion: integer("active_profile_version"),

  metaJson: text("meta_json"),
});

export const pipelineStepRuns = sqliteTable("pipeline_step_runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("global"),
  runId: text("run_id")
    .notNull()
    .references(() => pipelineRuns.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(),
  stepType: text("step_type", { enum: ["pre", "rag", "llm", "post", "tool"] })
    .notNull()
    .default("llm"),
  status: text("status", { enum: ["running", "done", "aborted", "error", "skipped"] })
    .notNull()
    .default("running"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  error: text("error"),
});

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
    pipelineRunId: text("pipeline_run_id").references(() => pipelineRuns.id, {
      onDelete: "set null",
    }),
    pipelineStepRunId: text("pipeline_step_run_id").references(
      () => pipelineStepRuns.id,
      { onDelete: "set null" }
    ),

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

export const uiSidebarsState = sqliteTable("ui_sidebars_state", {
  id: text("id").primaryKey(), // e.g. "global"
  stateJson: text("state_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// ---- User persons (global, v1)

export const userPersons = sqliteTable(
  "user_persons",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    name: text("name").notNull(),
    prefix: text("prefix"),
    // Used by web UI + AvatarUpload; kept as a simple string path/url.
    avatarUrl: text("avatar_url"),
    type: text("type", { enum: ["default", "extended"] })
      .notNull()
      .default("default"),
    contentTypeDefault: text("content_type_default"),
    contentTypeExtendedJson: text("content_type_extended_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("user_persons_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
  })
);

export const userPersonsSettings = sqliteTable("user_persons_settings", {
  ownerId: text("owner_id").primaryKey().notNull().default("global"),
  selectedId: text("selected_id").references(() => userPersons.id, {
    onDelete: "set null",
  }),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  metaJson: text("meta_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

