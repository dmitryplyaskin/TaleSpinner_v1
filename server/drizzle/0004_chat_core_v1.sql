-- Chat Core v1 (greenfield for legacy chats/messages)
-- Based on docs/chat-core-spec.md (no RAG tables in this migration)

DROP TABLE IF EXISTS `chat_messages`;
--> statement-breakpoint
DROP TABLE IF EXISTS `chats`;
--> statement-breakpoint

CREATE TABLE `entity_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`name` text NOT NULL,
	`kind` text DEFAULT 'CharSpec' NOT NULL,
	`spec_json` text NOT NULL,
	`meta_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`avatar_asset_id` text
);
--> statement-breakpoint
CREATE INDEX `entity_profiles_owner_updated_at_idx` ON `entity_profiles` (`owner_id`,`updated_at`);
--> statement-breakpoint

CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`entity_profile_id` text NOT NULL,
	`title` text NOT NULL,
	`active_branch_id` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_message_at` integer,
	`last_message_preview` text,
	`version` integer DEFAULT 0 NOT NULL,
	`meta_json` text,
	`origin_chat_id` text,
	`origin_branch_id` text,
	`origin_message_id` text,
	FOREIGN KEY (`entity_profile_id`) REFERENCES `entity_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chats_entity_profile_updated_at_idx` ON `chats` (`entity_profile_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `chats_owner_updated_at_idx` ON `chats` (`owner_id`,`updated_at`);
--> statement-breakpoint

CREATE TABLE `chat_branches` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`chat_id` text NOT NULL,
	`title` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`parent_branch_id` text,
	`forked_from_message_id` text,
	`forked_from_variant_id` text,
	`meta_json` text,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_branches_chat_created_at_idx` ON `chat_branches` (`chat_id`,`created_at`);
--> statement-breakpoint

CREATE TABLE `chat_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`chat_id` text NOT NULL,
	`branch_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`prompt_text` text DEFAULT '' NOT NULL,
	`format` text,
	`blocks_json` text DEFAULT '[]' NOT NULL,
	`meta_json` text,
	`active_variant_id` text,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`branch_id`) REFERENCES `chat_branches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `chat_messages_chat_branch_created_at_idx` ON `chat_messages` (`chat_id`,`branch_id`,`created_at`);
--> statement-breakpoint

CREATE TABLE `message_variants` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`message_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`kind` text NOT NULL,
	`prompt_text` text DEFAULT '' NOT NULL,
	`blocks_json` text DEFAULT '[]' NOT NULL,
	`meta_json` text,
	`is_selected` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `message_variants_message_created_at_idx` ON `message_variants` (`message_id`,`created_at`);
--> statement-breakpoint

CREATE TABLE `prompt_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`scope` text NOT NULL,
	`scope_id` text,
	`engine` text DEFAULT 'liquidjs' NOT NULL,
	`template_text` text NOT NULL,
	`meta_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `prompt_templates_scope_scope_id_enabled_idx` ON `prompt_templates` (`scope`,`scope_id`,`enabled`);
--> statement-breakpoint

CREATE TABLE `llm_generations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`chat_id` text NOT NULL,
	`message_id` text NOT NULL,
	`variant_id` text,
	`provider_id` text NOT NULL,
	`model` text NOT NULL,
	`params_json` text NOT NULL,
	`status` text DEFAULT 'streaming' NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer,
	`prompt_hash` text,
	`prompt_snapshot_json` text,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`error` text,
	FOREIGN KEY (`chat_id`) REFERENCES `chats`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`message_id`) REFERENCES `chat_messages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `message_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `llm_generations_chat_started_at_idx` ON `llm_generations` (`chat_id`,`started_at`);