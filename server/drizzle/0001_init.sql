CREATE TABLE `llm_provider_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`config_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `llm_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `llm_providers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `llm_runtime_settings` (
	`scope` text NOT NULL,
	`scope_id` text NOT NULL,
	`active_provider_id` text NOT NULL,
	`active_token_id` text,
	`active_model` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`active_provider_id`) REFERENCES `llm_providers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`active_token_id`) REFERENCES `llm_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_runtime_scope_scope_id_uq` ON `llm_runtime_settings` (`scope`,`scope_id`);--> statement-breakpoint
CREATE TABLE `llm_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`provider_id` text NOT NULL,
	`name` text NOT NULL,
	`ciphertext` text NOT NULL,
	`token_hint` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`provider_id`) REFERENCES `llm_providers`(`id`) ON UPDATE no action ON DELETE cascade
);
