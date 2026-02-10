CREATE TABLE `ui_theme_presets` (
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
CREATE INDEX `ui_theme_presets_owner_updated_at_idx`
  ON `ui_theme_presets` (`owner_id`,`updated_at`);
--> statement-breakpoint
CREATE TABLE `ui_theme_settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`active_preset_id` text,
	`color_scheme` text DEFAULT 'auto' NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`active_preset_id`) REFERENCES `ui_theme_presets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `ui_theme_settings_active_preset_id_idx`
  ON `ui_theme_settings` (`active_preset_id`);

