import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const promptTemplates = sqliteTable(
  "prompt_templates",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),

    name: text("name").notNull(),
    engine: text("engine").notNull().default("liquidjs"),
    templateText: text("template_text").notNull(),
    metaJson: text("meta_json"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("prompt_templates_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
  })
);

