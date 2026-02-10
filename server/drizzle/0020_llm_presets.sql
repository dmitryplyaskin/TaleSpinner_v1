CREATE TABLE `llm_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`built_in` integer DEFAULT false NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `llm_presets_owner_updated_at_idx`
	ON `llm_presets` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `llm_preset_settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`active_preset_id` text,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`active_preset_id`) REFERENCES `llm_presets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `llm_preset_settings_active_preset_id_idx`
	ON `llm_preset_settings` (`active_preset_id`);
