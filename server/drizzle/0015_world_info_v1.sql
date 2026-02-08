CREATE TABLE IF NOT EXISTS `world_info_books` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `data_json` text NOT NULL,
  `extensions_json` text,
  `source` text NOT NULL DEFAULT 'native',
  `version` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  `deleted_at` integer
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `world_info_books_owner_updated_at_idx`
  ON `world_info_books` (`owner_id`, `updated_at`);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `world_info_books_owner_slug_active_uq`
  ON `world_info_books` (`owner_id`, `slug`)
  WHERE `deleted_at` IS NULL;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `world_info_settings` (
  `owner_id` text PRIMARY KEY NOT NULL DEFAULT 'global',
  `scan_depth` integer NOT NULL DEFAULT 2,
  `min_activations` integer NOT NULL DEFAULT 0,
  `min_activations_depth_max` integer NOT NULL DEFAULT 0,
  `budget_percent` integer NOT NULL DEFAULT 25,
  `budget_cap_tokens` integer NOT NULL DEFAULT 0,
  `context_window_tokens` integer NOT NULL DEFAULT 8192,
  `include_names` integer NOT NULL DEFAULT 1,
  `recursive` integer NOT NULL DEFAULT 0,
  `overflow_alert` integer NOT NULL DEFAULT 0,
  `case_sensitive` integer NOT NULL DEFAULT 0,
  `match_whole_words` integer NOT NULL DEFAULT 0,
  `use_group_scoring` integer NOT NULL DEFAULT 0,
  `character_strategy` integer NOT NULL DEFAULT 1,
  `max_recursion_steps` integer NOT NULL DEFAULT 0,
  `meta_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `world_info_bindings` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `scope` text NOT NULL,
  `scope_id` text,
  `book_id` text NOT NULL,
  `binding_role` text NOT NULL DEFAULT 'additional',
  `display_order` integer NOT NULL DEFAULT 0,
  `enabled` integer NOT NULL DEFAULT 1,
  `meta_json` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`book_id`) REFERENCES `world_info_books`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `world_info_bindings_owner_scope_display_order_idx`
  ON `world_info_bindings` (`owner_id`, `scope`, `scope_id`, `display_order`);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `world_info_bindings_scope_book_uq`
  ON `world_info_bindings` (`owner_id`, `scope`, `scope_id`, `book_id`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `world_info_timed_effects` (
  `id` text PRIMARY KEY NOT NULL,
  `owner_id` text NOT NULL DEFAULT 'global',
  `chat_id` text NOT NULL,
  `branch_id` text NOT NULL,
  `entry_hash` text NOT NULL,
  `book_id` text,
  `entry_uid` integer,
  `effect_type` text NOT NULL,
  `start_message_index` integer NOT NULL,
  `end_message_index` integer NOT NULL,
  `protected` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`branch_id`) REFERENCES `chat_branches`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `world_info_timed_effects_chat_branch_effect_end_idx`
  ON `world_info_timed_effects` (`chat_id`, `branch_id`, `effect_type`, `end_message_index`);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `world_info_timed_effects_unique_entry_effect_uq`
  ON `world_info_timed_effects` (`owner_id`, `chat_id`, `branch_id`, `entry_hash`, `effect_type`);
