CREATE TABLE `ui_app_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`language` text DEFAULT 'ru' NOT NULL,
	`open_last_chat` integer DEFAULT false NOT NULL,
	`auto_select_current_persona` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
