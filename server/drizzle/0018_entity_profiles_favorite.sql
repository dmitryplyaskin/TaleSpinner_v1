ALTER TABLE `entity_profiles` ADD COLUMN `is_favorite` integer DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE INDEX `entity_profiles_owner_favorite_updated_at_idx` ON `entity_profiles` (`owner_id`,`is_favorite`,`updated_at`);
