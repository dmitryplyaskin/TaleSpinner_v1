PRAGMA foreign_keys=OFF;
--> statement-breakpoint

CREATE TABLE `llm_generations__new` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text DEFAULT 'global' NOT NULL,
  `chat_id` text NOT NULL,
  `branch_id` text,
  `message_id` text,
  `variant_id` text,
  `provider_id` text NOT NULL,
  `model` text NOT NULL,
  `params_json` text NOT NULL,
  `status` text DEFAULT 'streaming' NOT NULL,
  `started_at` integer NOT NULL,
  `finished_at` integer,
  `prompt_hash` text,
  `prompt_snapshot_json` text,
  `phase_report_json` text,
  `commit_report_json` text,
  `prompt_tokens` integer,
  `completion_tokens` integer,
  `error` text,
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`variant_id`) REFERENCES `message_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

INSERT INTO `llm_generations__new` (
  `id`,
  `owner_id`,
  `chat_id`,
  `branch_id`,
  `message_id`,
  `variant_id`,
  `provider_id`,
  `model`,
  `params_json`,
  `status`,
  `started_at`,
  `finished_at`,
  `prompt_hash`,
  `prompt_snapshot_json`,
  `phase_report_json`,
  `commit_report_json`,
  `prompt_tokens`,
  `completion_tokens`,
  `error`
)
SELECT
  `id`,
  `owner_id`,
  `chat_id`,
  `branch_id`,
  `message_id`,
  `variant_id`,
  `provider_id`,
  `model`,
  `params_json`,
  `status`,
  `started_at`,
  `finished_at`,
  `prompt_hash`,
  `prompt_snapshot_json`,
  `phase_report_json`,
  `commit_report_json`,
  `prompt_tokens`,
  `completion_tokens`,
  `error`
FROM `llm_generations`;
--> statement-breakpoint

DROP TABLE `llm_generations`;
--> statement-breakpoint

ALTER TABLE `llm_generations__new` RENAME TO `llm_generations`;
--> statement-breakpoint

CREATE INDEX `llm_generations_chat_started_at_idx` ON `llm_generations` (`chat_id`,`started_at`);
--> statement-breakpoint

CREATE INDEX `llm_generations_chat_branch_started_at_idx` ON `llm_generations` (`chat_id`,`branch_id`,`started_at`);
--> statement-breakpoint

PRAGMA foreign_keys=ON;
