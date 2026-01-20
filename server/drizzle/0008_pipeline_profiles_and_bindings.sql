-- Pipeline profiles + bindings (Phase 2/3 foundation)

CREATE TABLE IF NOT EXISTS `pipeline_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `name` text NOT NULL,
  `version` integer NOT NULL DEFAULT 1,
  `spec_json` text NOT NULL,
  `meta_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `pipeline_profiles_owner_updated_at_idx`
  ON `pipeline_profiles` (`owner_id`, `updated_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `pipeline_profile_bindings` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `scope` text NOT NULL,
  -- Note: empty string means global scope (so uniqueness works in SQLite).
  `scope_id` text NOT NULL DEFAULT '',
  `profile_id` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`profile_id`) REFERENCES `pipeline_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `pipeline_profile_bindings_owner_scope_scope_id_uq`
  ON `pipeline_profile_bindings` (`owner_id`, `scope`, `scope_id`);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `pipeline_profile_bindings_profile_id_idx`
  ON `pipeline_profile_bindings` (`profile_id`);

