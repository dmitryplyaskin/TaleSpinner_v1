-- User persons (global) v1

CREATE TABLE IF NOT EXISTS `user_persons` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`name` text NOT NULL,
	`prefix` text,
	`avatar_url` text,
	`type` text DEFAULT 'default' NOT NULL,
	`content_type_default` text,
	`content_type_extended_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `user_persons_owner_updated_at_idx` ON `user_persons` (`owner_id`,`updated_at`);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `user_persons_settings` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`selected_id` text,
	`enabled` integer DEFAULT false NOT NULL,
	`meta_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`selected_id`) REFERENCES `user_persons`(`id`) ON UPDATE no action ON DELETE set null
);

