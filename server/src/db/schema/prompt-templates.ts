import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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

