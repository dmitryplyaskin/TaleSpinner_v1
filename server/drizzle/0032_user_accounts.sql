CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`normalized_username` text NOT NULL,
	`display_name` text NOT NULL,
	`password_hash` text,
	`role` text DEFAULT 'user' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`credential_version` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_normalized_username_uq` ON `users` (`normalized_username`);
--> statement-breakpoint
CREATE INDEX `users_status_updated_at_idx` ON `users` (`status`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`csrf_token_hash` text NOT NULL,
	`auth_method` text NOT NULL,
	`credential_version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_sessions_token_hash_uq` ON `auth_sessions` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `auth_sessions_user_expires_at_idx` ON `auth_sessions` (`user_id`,`expires_at`);
--> statement-breakpoint
CREATE INDEX `auth_sessions_expires_at_idx` ON `auth_sessions` (`expires_at`);
--> statement-breakpoint
ALTER TABLE `llm_provider_configs` ADD `owner_id` text DEFAULT 'global' NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_provider_configs_owner_provider_uq` ON `llm_provider_configs` (`owner_id`,`provider_id`);
--> statement-breakpoint
ALTER TABLE `llm_tokens` ADD `owner_id` text DEFAULT 'global' NOT NULL;
--> statement-breakpoint
CREATE INDEX `llm_tokens_owner_provider_idx` ON `llm_tokens` (`owner_id`,`provider_id`);
--> statement-breakpoint
ALTER TABLE `ui_app_backgrounds` ADD `owner_id` text DEFAULT 'global' NOT NULL;
--> statement-breakpoint
CREATE INDEX `ui_app_backgrounds_owner_id_idx` ON `ui_app_backgrounds` (`owner_id`);
