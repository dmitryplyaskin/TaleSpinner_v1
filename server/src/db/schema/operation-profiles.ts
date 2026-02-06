import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

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

export const operationProfileSessionArtifacts = sqliteTable(
  "operation_profile_session_artifacts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    sessionKey: text("session_key").notNull(),
    chatId: text("chat_id").notNull(),
    branchId: text("branch_id").notNull(),
    profileId: text("profile_id"),
    profileVersion: integer("profile_version"),
    operationProfileSessionId: text("operation_profile_session_id"),
    tag: text("tag").notNull(),
    usage: text("usage").notNull(),
    semantics: text("semantics").notNull(),
    valueJson: text("value_json").notNull(),
    historyJson: text("history_json"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    sessionTagUnique: uniqueIndex("op_profile_session_artifacts_session_tag_uq").on(
      t.sessionKey,
      t.tag
    ),
    ownerUpdatedAtIdx: index("op_profile_session_artifacts_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
    chatBranchUpdatedAtIdx: index("op_profile_session_artifacts_chat_branch_updated_at_idx").on(
      t.chatId,
      t.branchId,
      t.updatedAt
    ),
  })
);

