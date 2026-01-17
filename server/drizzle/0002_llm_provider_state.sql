CREATE TABLE `llm_runtime_provider_state` (
	`scope` text NOT NULL,
	`scope_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`last_token_id` text,
	`last_model` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`provider_id`) REFERENCES `llm_providers`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`last_token_id`) REFERENCES `llm_tokens`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `llm_runtime_provider_state_scope_scope_id_provider_uq` ON `llm_runtime_provider_state` (`scope`,`scope_id`,`provider_id`);