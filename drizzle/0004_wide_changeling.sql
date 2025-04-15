ALTER TABLE `games` ADD `featured_game` bigint unsigned;--> statement-breakpoint
ALTER TABLE `games` ADD `feature_expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `games` ADD CONSTRAINT `games_featured_game_fk` FOREIGN KEY (`featured_game`) REFERENCES `games`(`id`) ON DELETE no action ON UPDATE no action;