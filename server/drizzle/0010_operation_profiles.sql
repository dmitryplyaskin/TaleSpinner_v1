-- Operation profiles (Executable Operations)

CREATE TABLE IF NOT EXISTS `operation_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `name` text NOT NULL,
  `description` text,
  `enabled` integer NOT NULL DEFAULT 1,
  `execution_mode` text NOT NULL DEFAULT 'concurrent',
  `operation_profile_session_id` text NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `spec_json` text NOT NULL,
  `meta_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `operation_profiles_owner_updated_at_idx`
  ON `operation_profiles` (`owner_id`, `updated_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `operation_profile_settings` (
  `id` text PRIMARY KEY NOT NULL,
  `active_profile_id` text,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`active_profile_id`) REFERENCES `operation_profiles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `operation_profile_settings_active_profile_id_idx`
  ON `operation_profile_settings` (`active_profile_id`);

