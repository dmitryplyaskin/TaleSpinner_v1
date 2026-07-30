import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uiAppBackgrounds = sqliteTable(
  "ui_app_backgrounds",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    name: text("name").notNull(),
    fileName: text("file_name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => ({
    ownerIdIndex: index("ui_app_backgrounds_owner_id_idx").on(table.ownerId),
  })
);
