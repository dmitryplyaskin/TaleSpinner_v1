-- Prompt templates: remove scopes, store selection per-chat

ALTER TABLE `chats` ADD COLUMN `prompt_template_id` text;
--> statement-breakpoint

-- Backfill chat.prompt_template_id from legacy scoped templates:
-- chat scope > entity_profile scope > global scope.
UPDATE `chats`
SET `prompt_template_id` = COALESCE(
  (
    SELECT `id`
    FROM `prompt_templates`
    WHERE `owner_id` = `chats`.`owner_id`
      AND `enabled` = 1
      AND `scope` = 'chat'
      AND `scope_id` = `chats`.`id`
    ORDER BY `updated_at` DESC
    LIMIT 1
  ),
  (
    SELECT `id`
    FROM `prompt_templates`
    WHERE `owner_id` = `chats`.`owner_id`
      AND `enabled` = 1
      AND `scope` = 'entity_profile'
      AND `scope_id` = `chats`.`entity_profile_id`
    ORDER BY `updated_at` DESC
    LIMIT 1
  ),
  (
    SELECT `id`
    FROM `prompt_templates`
    WHERE `owner_id` = `chats`.`owner_id`
      AND `enabled` = 1
      AND `scope` = 'global'
      AND `scope_id` IS NULL
    ORDER BY `updated_at` DESC
    LIMIT 1
  )
);
--> statement-breakpoint

-- Rebuild `prompt_templates` as a global library (no scope / enabled columns).
CREATE TABLE `prompt_templates_new` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text DEFAULT 'global' NOT NULL,
	`name` text NOT NULL,
	`engine` text DEFAULT 'liquidjs' NOT NULL,
	`template_text` text NOT NULL,
	`meta_json` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint

INSERT INTO `prompt_templates_new` (
  `id`,
  `owner_id`,
  `name`,
  `engine`,
  `template_text`,
  `meta_json`,
  `created_at`,
  `updated_at`
)
SELECT
  `id`,
  `owner_id`,
  `name`,
  `engine`,
  `template_text`,
  `meta_json`,
  `created_at`,
  `updated_at`
FROM `prompt_templates`;
--> statement-breakpoint

DROP TABLE `prompt_templates`;
--> statement-breakpoint

ALTER TABLE `prompt_templates_new` RENAME TO `prompt_templates`;
--> statement-breakpoint

CREATE INDEX `prompt_templates_owner_updated_at_idx` ON `prompt_templates` (`owner_id`,`updated_at`);
