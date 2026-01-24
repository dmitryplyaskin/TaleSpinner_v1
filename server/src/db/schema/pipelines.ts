import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

import { chats, entityProfiles } from "./chat-core";

export const pipelines = sqliteTable("pipelines", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("global"),
  name: text("name").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  definitionJson: text("definition_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const pipelineProfiles = sqliteTable(
  "pipeline_profiles",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    name: text("name").notNull(),
    version: integer("version").notNull().default(1),
    specJson: text("spec_json").notNull(),
    metaJson: text("meta_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerUpdatedAtIdx: index("pipeline_profiles_owner_updated_at_idx").on(
      t.ownerId,
      t.updatedAt
    ),
  })
);

export const pipelineProfileBindings = sqliteTable(
  "pipeline_profile_bindings",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    scope: text("scope", { enum: ["global", "entity_profile", "chat"] }).notNull(),
    // Note: empty string means global scope (so uniqueness works in SQLite).
    scopeId: text("scope_id").notNull().default(""),
    profileId: text("profile_id")
      .notNull()
      .references(() => pipelineProfiles.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerScopeScopeIdUq: uniqueIndex(
      "pipeline_profile_bindings_owner_scope_scope_id_uq"
    ).on(t.ownerId, t.scope, t.scopeId),
    profileIdIdx: index("pipeline_profile_bindings_profile_id_idx").on(t.profileId),
  })
);

export const pipelineArtifacts = sqliteTable(
  "pipeline_artifacts",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull().default("global"),
    // v1: session is chat-scoped, so sessionId = chatId.
    sessionId: text("session_id").notNull(),
    tag: text("tag").notNull(),

    kind: text("kind").notNull().default("any"),
    access: text("access", { enum: ["persisted", "run_only"] })
      .notNull()
      .default("persisted"),
    visibility: text("visibility", {
      enum: ["prompt_only", "ui_only", "prompt_and_ui", "internal"],
    })
      .notNull()
      .default("internal"),
    // Note: SQLite doesn't enforce patterns; `panel:*` / `feed:*` are conventions.
    uiSurface: text("ui_surface").notNull().default("internal"),

    contentType: text("content_type", { enum: ["text", "json", "markdown"] })
      .notNull()
      .default("json"),
    contentJson: text("content_json"),
    contentText: text("content_text"),

    promptInclusionJson: text("prompt_inclusion_json"),
    retentionPolicyJson: text("retention_policy_json"),

    version: integer("version").notNull(),
    basedOnVersion: integer("based_on_version"),

    writerPipelineId: text("writer_pipeline_id"),
    writerStepName: text("writer_step_name"),

    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => ({
    ownerSessionTagVersionUq: uniqueIndex(
      "pipeline_artifacts_owner_session_tag_version_uq"
    ).on(t.ownerId, t.sessionId, t.tag, t.version),
    ownerSessionTagVersionIdx: index(
      "pipeline_artifacts_owner_session_tag_version_idx"
    ).on(t.ownerId, t.sessionId, t.tag, t.version),
    ownerSessionUpdatedAtIdx: index(
      "pipeline_artifacts_owner_session_updated_at_idx"
    ).on(t.ownerId, t.sessionId, t.updatedAt),
  })
);

export const pipelineRuns = sqliteTable("pipeline_runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("global"),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  entityProfileId: text("entity_profile_id")
    .notNull()
    .references(() => entityProfiles.id, { onDelete: "cascade" }),
  // Stable idempotency key for dedup (v1). Null when not used.
  idempotencyKey: text("idempotency_key"),
  trigger: text("trigger", {
    enum: ["user_message", "regenerate", "manual", "scheduled", "api"],
  })
    .notNull()
    .default("user_message"),
  status: text("status", { enum: ["running", "done", "error", "aborted"] })
    .notNull()
    .default("running"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),

  // Correlation ids / recovery helpers (v1)
  branchId: text("branch_id"),
  userMessageId: text("user_message_id"),
  assistantMessageId: text("assistant_message_id"),
  assistantVariantId: text("assistant_variant_id"),
  generationId: text("generation_id"),

  // Reserved for Phase 3 (PipelineProfile selection); stored for reproducibility/debug.
  activeProfileId: text("active_profile_id"),
  activeProfileVersion: integer("active_profile_version"),

  metaJson: text("meta_json"),
});

export const pipelineStepRuns = sqliteTable("pipeline_step_runs", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull().default("global"),
  runId: text("run_id")
    .notNull()
    .references(() => pipelineRuns.id, { onDelete: "cascade" }),
  stepName: text("step_name").notNull(),
  stepType: text("step_type", { enum: ["pre", "rag", "llm", "post", "tool"] })
    .notNull()
    .default("llm"),
  status: text("status", { enum: ["running", "done", "aborted", "error", "skipped"] })
    .notNull()
    .default("running"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  inputJson: text("input_json"),
  outputJson: text("output_json"),
  error: text("error"),
});

