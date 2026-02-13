ALTER TABLE `prompt_templates` RENAME TO `instructions`;
--> statement-breakpoint

DROP INDEX IF EXISTS `prompt_templates_owner_updated_at_idx`;
--> statement-breakpoint

CREATE INDEX `instructions_owner_updated_at_idx` ON `instructions` (`owner_id`,`updated_at`);
--> statement-breakpoint

ALTER TABLE `chats` RENAME COLUMN `prompt_template_id` TO `instruction_id`;
