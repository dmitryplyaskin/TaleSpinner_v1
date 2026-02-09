import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uiSidebarsState = sqliteTable("ui_sidebars_state", {
  id: text("id").primaryKey(), // e.g. "global"
  stateJson: text("state_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const uiAppSettings = sqliteTable("ui_app_settings", {
  id: text("id").primaryKey(), // e.g. "global"
  language: text("language", { enum: ["ru", "en"] }).notNull().default("ru"),
  openLastChat: integer("open_last_chat", { mode: "boolean" }).notNull().default(false),
  autoSelectCurrentPersona: integer("auto_select_current_persona", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

