-- Pipeline artifacts (Phase 4 foundations): Latest + History per (owner_id, session_id, tag)

CREATE TABLE IF NOT EXISTS `pipeline_artifacts` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  -- v1: session is chat-scoped, so session_id = chatId
  `session_id` text NOT NULL,
  -- v1: persisted artifacts are addressable as `art.<tag>` (unique per session)
  `tag` text NOT NULL,

  `kind` text NOT NULL DEFAULT 'any',
  `access` text NOT NULL DEFAULT 'persisted', -- persisted | run_only
  `visibility` text NOT NULL DEFAULT 'internal', -- prompt_only | ui_only | prompt_and_ui | internal
  `ui_surface` text NOT NULL DEFAULT 'internal', -- chat_history | panel:* | feed:* | overlay:* | internal

  `content_type` text NOT NULL DEFAULT 'json', -- text | json | markdown
  `content_json` text,
  `content_text` text,

  -- Optional rules for prompt inclusion + retention (opaque JSON in v1).
  `prompt_inclusion_json` text,
  `retention_policy_json` text,

  -- Monotonic versioning per (owner_id, session_id, tag).
  `version` integer NOT NULL,
  `based_on_version` integer,

  -- Writer identity (for single-writer runtime guard).
  `writer_pipeline_id` text,
  `writer_step_name` text,

  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `pipeline_artifacts_owner_session_tag_version_uq`
  ON `pipeline_artifacts` (`owner_id`, `session_id`, `tag`, `version`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `pipeline_artifacts_owner_session_tag_version_idx`
  ON `pipeline_artifacts` (`owner_id`, `session_id`, `tag`, `version`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `pipeline_artifacts_owner_session_updated_at_idx`
  ON `pipeline_artifacts` (`owner_id`, `session_id`, `updated_at`);

