import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { chatBranches, chats } from "./chat-core";

export const worldInfoBooks = sqliteTable(
  "world_info_books",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    dataJson: text("data_json").notNull(),
    extensionsJson: text("extensions_json"),
    source: text("source", { enum: ["native", "imported", "converted"] })
      .notNull()
      .default("native"),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("world_info_books_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
  })
);

export const worldInfoSettings = sqliteTable("world_info_settings", {
  ownerId: text("owner_id").primaryKey().notNull().default("global"),
  scanDepth: integer("scan_depth").notNull().default(2),
  minActivations: integer("min_activations").notNull().default(0),
  minActivationsDepthMax: integer("min_activations_depth_max").notNull().default(0),
  budgetPercent: integer("budget_percent").notNull().default(25),
  budgetCapTokens: integer("budget_cap_tokens").notNull().default(0),
  contextWindowTokens: integer("context_window_tokens").notNull().default(8192),
  includeNames: integer("include_names", { mode: "boolean" }).notNull().default(true),
  recursive: integer("recursive", { mode: "boolean" }).notNull().default(false),
  overflowAlert: integer("overflow_alert", { mode: "boolean" }).notNull().default(false),
  caseSensitive: integer("case_sensitive", { mode: "boolean" }).notNull().default(false),
  matchWholeWords: integer("match_whole_words", { mode: "boolean" }).notNull().default(false),
  useGroupScoring: integer("use_group_scoring", { mode: "boolean" }).notNull().default(false),
  characterStrategy: integer("character_strategy").notNull().default(1),
  maxRecursionSteps: integer("max_recursion_steps").notNull().default(0),
  metaJson: text("meta_json"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const worldInfoBindings = sqliteTable(
  "world_info_bindings",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    scope: text("scope", { enum: ["global", "chat", "entity_profile", "persona"] }).notNull(),
    scopeId: text("scope_id"),
    bookId: text("book_id")
      .notNull()
      .references(() => worldInfoBooks.id, { onDelete: "cascade" }),
    bindingRole: text("binding_role", { enum: ["primary", "additional"] })
      .notNull()
      .default("additional"),
    displayOrder: integer("display_order").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    metaJson: text("meta_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerScopeDisplayOrderIdx: index("world_info_bindings_owner_scope_display_order_idx").on(
      t.ownerId,
      t.scope,
      t.scopeId,
      t.displayOrder
    ),
  })
);

export const worldInfoTimedEffects = sqliteTable(
  "world_info_timed_effects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => chatBranches.id, { onDelete: "cascade" }),
    entryHash: text("entry_hash").notNull(),
    bookId: text("book_id"),
    entryUid: integer("entry_uid"),
    effectType: text("effect_type", { enum: ["sticky", "cooldown"] }).notNull(),
    startMessageIndex: integer("start_message_index").notNull(),
    endMessageIndex: integer("end_message_index").notNull(),
    protected: integer("protected", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    chatBranchEffectEndIdx: index("world_info_timed_effects_chat_branch_effect_end_idx").on(
      t.chatId,
      t.branchId,
      t.effectType,
      t.endMessageIndex
    ),
  })
);
