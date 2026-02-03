-- Chat Entries / Variants / Parts (chat-entry-parts v1)

CREATE TABLE `chat_entries` (
  `entry_id` text PRIMARY KEY NOT NULL,
  `owner_id` text DEFAULT 'global' NOT NULL,
  `chat_id` text NOT NULL,
  `branch_id` text NOT NULL,
  `role` text NOT NULL,
  `created_at` integer NOT NULL,
  `active_variant_id` text NOT NULL,
  `soft_deleted` integer DEFAULT false NOT NULL,
  `soft_deleted_at` integer,
  `soft_deleted_by` text,
  `meta_json` text,
  FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`branch_id`) REFERENCES `chat_branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX `chat_entries_chat_branch_created_at_idx`
  ON `chat_entries` (`chat_id`, `branch_id`, `created_at`);
--> statement-breakpoint

CREATE TABLE `entry_variants` (
  `variant_id` text PRIMARY KEY NOT NULL,
  `owner_id` text DEFAULT 'global' NOT NULL,
  `entry_id` text NOT NULL,
  `kind` text NOT NULL,
  `created_at` integer NOT NULL,
  `derived_json` text,
  FOREIGN KEY (`entry_id`) REFERENCES `chat_entries`(`entry_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX `entry_variants_entry_created_at_idx`
  ON `entry_variants` (`entry_id`, `created_at`);
--> statement-breakpoint

CREATE TABLE `variant_parts` (
  `part_id` text PRIMARY KEY NOT NULL,
  `owner_id` text DEFAULT 'global' NOT NULL,
  `variant_id` text NOT NULL,
  `channel` text NOT NULL,
  `order` integer NOT NULL,
  `payload_json` text NOT NULL,
  `visibility_json` text NOT NULL,
  `ui_json` text,
  `prompt_json` text,
  `lifespan_json` text NOT NULL,
  `created_turn` integer NOT NULL,
  `source` text NOT NULL,
  `agent_id` text,
  `model` text,
  `request_id` text,
  `replaces_part_id` text,
  `soft_deleted` integer DEFAULT false NOT NULL,
  `soft_deleted_at` integer,
  `soft_deleted_by` text,
  `tags_json` text,
  FOREIGN KEY (`variant_id`) REFERENCES `entry_variants`(`variant_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint

CREATE INDEX `variant_parts_variant_order_idx`
  ON `variant_parts` (`variant_id`, `order`);
--> statement-breakpoint

CREATE INDEX `variant_parts_variant_channel_idx`
  ON `variant_parts` (`variant_id`, `channel`);
--> statement-breakpoint

ALTER TABLE `chat_branches` ADD COLUMN `current_turn` integer DEFAULT 0 NOT NULL;

