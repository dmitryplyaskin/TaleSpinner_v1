import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uiSidebarsState = sqliteTable("ui_sidebars_state", {
  id: text("id").primaryKey(), // e.g. "global"
  stateJson: text("state_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

