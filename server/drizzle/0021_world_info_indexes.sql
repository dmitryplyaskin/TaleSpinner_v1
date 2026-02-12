CREATE INDEX IF NOT EXISTS `world_info_books_owner_slug_deleted_idx`
  ON `world_info_books` (`owner_id`, `slug`, `deleted_at`);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `world_info_bindings_scope_book_uq`
  ON `world_info_bindings` (`owner_id`, `scope`, `scope_id`, `book_id`);
--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS `world_info_timed_effects_unique_entry_effect_uq`
  ON `world_info_timed_effects` (`owner_id`, `chat_id`, `branch_id`, `entry_hash`, `effect_type`);
