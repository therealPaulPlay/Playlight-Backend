ALTER TABLE `games` DROP FOREIGN KEY `games_featured_game_fk`;
--> statement-breakpoint
ALTER TABLE `games` ADD CONSTRAINT `games_featured_game_fk` FOREIGN KEY (`featured_game`) REFERENCES `games`(`id`) ON DELETE set null ON UPDATE no action;