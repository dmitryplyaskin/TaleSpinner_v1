CREATE TABLE IF NOT EXISTS `operation_blocks` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `name` text NOT NULL,
  `description` text,
  `enabled` integer NOT NULL DEFAULT 1,
  `version` integer NOT NULL DEFAULT 1,
  `spec_json` text NOT NULL,
  `meta_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `operation_blocks_owner_updated_at_idx`
  ON `operation_blocks` (`owner_id`, `updated_at`);
