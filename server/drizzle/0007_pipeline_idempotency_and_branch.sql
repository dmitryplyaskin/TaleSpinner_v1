-- Pipeline idempotency + branch correlation (Phase 0 extension)

ALTER TABLE `pipeline_runs` ADD COLUMN `idempotency_key` text;
--> statement-breakpoint

-- v1 idempotency key (nulls allowed).
CREATE UNIQUE INDEX IF NOT EXISTS `pipeline_runs_chat_idempotency_key_uq`
  ON `pipeline_runs` (`chat_id`, `idempotency_key`);
--> statement-breakpoint

ALTER TABLE `llm_generations` ADD COLUMN `branch_id` text;
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `llm_generations_chat_branch_started_at_idx`
  ON `llm_generations` (`chat_id`, `branch_id`, `started_at`);

