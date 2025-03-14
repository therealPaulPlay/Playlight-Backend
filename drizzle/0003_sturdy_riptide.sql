DROP INDEX `ip_idx` ON `likes`;--> statement-breakpoint
DROP INDEX `game_id_ip_idx` ON `likes`;--> statement-breakpoint
ALTER TABLE `likes` ADD CONSTRAINT `game_id_ip_idx` UNIQUE(`game_id`,`ip`);