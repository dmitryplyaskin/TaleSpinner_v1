import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uiThemePresets = sqliteTable(
  "ui_theme_presets",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    name: text("name").notNull(),
    description: text("description"),
    builtIn: integer("built_in", { mode: "boolean" }).notNull().default(false),
    version: integer("version").notNull().default(1),
    payloadJson: text("payload_json").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("ui_theme_presets_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
  })
);

export const uiThemeSettings = sqliteTable(
  "ui_theme_settings",
  {
    ownerId: text("owner_id").primaryKey(),
    activePresetId: text("active_preset_id").references(() => uiThemePresets.id, {
      onDelete: "set null",
    }),
    colorScheme: text("color_scheme", {
      enum: ["light", "dark", "auto"],
    })
      .notNull()
      .default("auto"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    activePresetIdIdx: index("ui_theme_settings_active_preset_id_idx").on(
      t.activePresetId
    ),
  })
);

