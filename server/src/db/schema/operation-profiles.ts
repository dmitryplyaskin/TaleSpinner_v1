import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

// ---- Executable Operations (OperationProfile storage)

export const operationProfiles = sqliteTable(
  "operation_profiles",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    name: text("name").notNull(),
    description: text("description"),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    executionMode: text("execution_mode", {
      enum: ["concurrent", "sequential"],
    })
      .notNull()
      .default("concurrent"),
    operationProfileSessionId: text("operation_profile_session_id").notNull(),
    version: integer("version").notNull().default(1),
    specJson: text("spec_json").notNull(),
    metaJson: text("meta_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("operation_profiles_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
  })
);

export const operationProfileSettings = sqliteTable(
  "operation_profile_settings",
  {
    id: text("id").primaryKey(), // e.g. "global"
    activeProfileId: text("active_profile_id").references(
      () => operationProfiles.id,
      { onDelete: "set null" }
    ),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    activeProfileIdIdx: index("operation_profile_settings_active_profile_id_idx").on(
      t.activeProfileId
    ),
  })
);

