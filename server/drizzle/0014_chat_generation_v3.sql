ALTER TABLE `llm_generations` ADD COLUMN `phase_report_json` text;
--> statement-breakpoint

ALTER TABLE `llm_generations` ADD COLUMN `commit_report_json` text;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `operation_profile_session_artifacts` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `session_key` text NOT NULL,
  `chat_id` text NOT NULL,
  `branch_id` text NOT NULL,
  `profile_id` text,
  `profile_version` integer,
  `operation_profile_session_id` text,
  `tag` text NOT NULL,
  `usage` text NOT NULL,
  `semantics` text NOT NULL,
  `value_json` text NOT NULL,
  `history_json` text,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `op_profile_session_artifacts_session_tag_uq`
  ON `operation_profile_session_artifacts` (`session_key`, `tag`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `op_profile_session_artifacts_owner_updated_at_idx`
  ON `operation_profile_session_artifacts` (`owner_id`, `updated_at`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `op_profile_session_artifacts_chat_branch_updated_at_idx`
  ON `operation_profile_session_artifacts` (`chat_id`, `branch_id`, `updated_at`);
