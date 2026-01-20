-- Pipeline foundations v1 (Phase 0)
-- Adds correlation columns + idempotency indexes for pipeline runs.

ALTER TABLE `pipeline_runs` ADD COLUMN `branch_id` text;
--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD COLUMN `user_message_id` text;
--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD COLUMN `assistant_message_id` text;
--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD COLUMN `assistant_variant_id` text;
--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD COLUMN `generation_id` text;
--> statement-breakpoint

-- Reserved for Phase 3 (profile selection), kept here to avoid churn later.
ALTER TABLE `pipeline_runs` ADD COLUMN `active_profile_id` text;
--> statement-breakpoint
ALTER TABLE `pipeline_runs` ADD COLUMN `active_profile_version` integer;
--> statement-breakpoint

-- Query helpers / recovery.
CREATE INDEX IF NOT EXISTS `pipeline_runs_chat_status_started_at_idx`
  ON `pipeline_runs` (`chat_id`, `status`, `started_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `pipeline_step_runs_run_started_at_idx`
  ON `pipeline_step_runs` (`run_id`, `started_at`);
--> statement-breakpoint

-- v1 idempotency keys (nulls are allowed; uniqueness applies only when value is present).
CREATE UNIQUE INDEX IF NOT EXISTS `pipeline_runs_chat_user_message_id_uq`
  ON `pipeline_runs` (`chat_id`, `user_message_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `pipeline_runs_chat_assistant_variant_id_uq`
  ON `pipeline_runs` (`chat_id`, `assistant_variant_id`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `llm_generations_pipeline_run_started_at_idx`
  ON `llm_generations` (`pipeline_run_id`, `started_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `llm_generations_pipeline_step_run_started_at_idx`
  ON `llm_generations` (`pipeline_step_run_id`, `started_at`);

