import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
    type: text("type", { enum: ["default", "extended"] }).notNull().default("default"),
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

