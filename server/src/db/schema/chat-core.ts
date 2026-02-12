import {
  index,
  integer,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

/**
 * Chat Core v1 (knowledge-base/chat-core-spec.md)
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
    isFavorite: integer("is_favorite", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    avatarAssetId: text("avatar_asset_id"),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("entity_profiles_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
    ownerFavoriteUpdatedAtIdx: index("entity_profiles_owner_favorite_updated_at_idx").on(
      t.ownerId,
      t.isFavorite,
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
    // Selected prompt template for this chat (all templates are global; chat stores the ref).
    promptTemplateId: text("prompt_template_id"),
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
    ownerUpdatedAtIdx: index("chats_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
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

    // Chat-entry-parts: monotonically increasing per-branch turn counter.
    // Incremented once per LLM call; used for Part TTL calculations.
    currentTurn: integer("current_turn").notNull().default(0),
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
    // Note: SQLite doesn't enforce enum values here; keep list in sync with app logic.
    kind: text("kind", {
      enum: ["generation", "manual_edit", "import", "raw_user_input", "message_transform"],
    }).notNull(),
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

