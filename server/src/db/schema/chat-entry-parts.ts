import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { chats, chatBranches } from "./chat-core";

/**
 * Chat Entries / Variants / Parts (docs/chat-entry-parts-spec-2026-02-01.md)
 *
 * This is a new normalized storage model. Legacy chat-core tables remain for now,
 * but are no longer the canonical store for chat content once v2 endpoints are used.
 */

export const chatEntries = sqliteTable(
  "chat_entries",
  {
    entryId: text("entry_id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),

    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => chatBranches.id, { onDelete: "cascade" }),

    role: text("role", { enum: ["system", "user", "assistant"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),

    activeVariantId: text("active_variant_id").notNull(),

    softDeleted: integer("soft_deleted", { mode: "boolean" }).notNull().default(false),
    softDeletedAt: integer("soft_deleted_at", { mode: "timestamp_ms" }),
    softDeletedBy: text("soft_deleted_by", { enum: ["user", "agent"] }),

    metaJson: text("meta_json"),
  },
  (t) => ({
    chatBranchCreatedAtIdx: index("chat_entries_chat_branch_created_at_idx").on(
      t.chatId,
      t.branchId,
      t.createdAt
    ),
  })
);

export const entryVariants = sqliteTable(
  "entry_variants",
  {
    variantId: text("variant_id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),

    entryId: text("entry_id")
      .notNull()
      .references(() => chatEntries.entryId, { onDelete: "cascade" }),

    kind: text("kind", { enum: ["generation", "manual_edit", "import"] }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),

    derivedJson: text("derived_json"),
  },
  (t) => ({
    entryCreatedAtIdx: index("entry_variants_entry_created_at_idx").on(t.entryId, t.createdAt),
  })
);

export const variantParts = sqliteTable(
  "variant_parts",
  {
    partId: text("part_id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),

    variantId: text("variant_id")
      .notNull()
      .references(() => entryVariants.variantId, { onDelete: "cascade" }),

    channel: text("channel", { enum: ["main", "reasoning", "aux", "trace"] }).notNull(),
    order: integer("order").notNull(),

    payloadJson: text("payload_json").notNull(), // JSON string: { format, value, schemaId?, label? }
    visibilityJson: text("visibility_json").notNull(), // JSON string: { ui, prompt }
    uiJson: text("ui_json"), // JSON string
    promptJson: text("prompt_json"), // JSON string

    lifespanJson: text("lifespan_json").notNull(), // JSON string: "infinite" | { turns }
    createdTurn: integer("created_turn").notNull(),

    source: text("source", { enum: ["llm", "agent", "user", "import"] }).notNull(),
    agentId: text("agent_id"),
    model: text("model"),
    requestId: text("request_id"),

    replacesPartId: text("replaces_part_id"),

    softDeleted: integer("soft_deleted", { mode: "boolean" }).notNull().default(false),
    softDeletedAt: integer("soft_deleted_at", { mode: "timestamp_ms" }),
    softDeletedBy: text("soft_deleted_by", { enum: ["user", "agent"] }),

    tagsJson: text("tags_json"),
  },
  (t) => ({
    variantOrderIdx: index("variant_parts_variant_order_idx").on(t.variantId, t.order),
    variantChannelIdx: index("variant_parts_variant_channel_idx").on(t.variantId, t.channel),
  })
);

