CREATE TABLE `events` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`game_id` bigint unsigned NOT NULL,
	`type` varchar(50) NOT NULL,
	`format` varchar(50),
	`metadata` json,
	`created_at` timestamp NOT NULL,
	CONSTRAINT `events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP INDEX `game_id_date_idx` ON `statistics`;--> statement-breakpoint
ALTER TABLE `statistics` ADD CONSTRAINT `game_id_date_idx` UNIQUE(`game_id`,`date`);--> statement-breakpoint
ALTER TABLE `events` ADD CONSTRAINT `events_game_id_games_id_fk` FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `game_id_idx` ON `events` (`game_id`);--> statement-breakpoint
CREATE INDEX `type_idx` ON `events` (`type`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `events` (`created_at`);--> statement-breakpoint
CREATE INDEX `game_id_type_format_idx` ON `events` (`game_id`,`type`,`format`);