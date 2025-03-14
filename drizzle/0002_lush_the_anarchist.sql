CREATE TABLE `likes` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`game_id` bigint unsigned NOT NULL,
	`date` timestamp NOT NULL,
	`ip` varchar(255),
	CONSTRAINT `likes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `games` ADD `likes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `likes` ADD CONSTRAINT `likes_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `game_id_idx` ON `likes` (`game_id`);--> statement-breakpoint
CREATE INDEX `ip_idx` ON `likes` (`ip`);--> statement-breakpoint
CREATE INDEX `game_id_ip_idx` ON `likes` (`game_id`,`ip`);