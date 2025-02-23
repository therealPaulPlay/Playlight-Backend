CREATE TABLE `users` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`user_name` varchar(50) NOT NULL,
	`email` varchar(100) NOT NULL,
	`password` varchar(255) NOT NULL,
	`is_admin` boolean NOT NULL DEFAULT false,
	`is_verified` boolean NOT NULL DEFAULT false,
	`verification_token` varchar(255),
	`created_at` timestamp NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `whitelist` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`email` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL,
	CONSTRAINT `whitelist_id` PRIMARY KEY(`id`),
	CONSTRAINT `email_idx` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `games` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`owner_id` int NOT NULL,
	`category` varchar(50) NOT NULL,
	`description` text,
	`logo_url` varchar(255),
	`cover_image_url` varchar(255),
	`cover_video_url` varchar(255),
	`domain` varchar(255) NOT NULL,
	`boost_factor` float NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL,
	CONSTRAINT `games_id` PRIMARY KEY(`id`),
	CONSTRAINT `domain_idx` UNIQUE(`domain`)
);
--> statement-breakpoint
CREATE TABLE `statistics` (
	`id` serial AUTO_INCREMENT NOT NULL,
	`game_id` int NOT NULL,
	`date` timestamp NOT NULL,
	`clicks` int NOT NULL DEFAULT 0,
	`playlight_opens` int NOT NULL DEFAULT 0,
	CONSTRAINT `statistics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `owner_id_idx` ON `games` (`owner_id`);--> statement-breakpoint
CREATE INDEX `category_idx` ON `games` (`category`);--> statement-breakpoint
CREATE INDEX `name_idx` ON `games` (`name`);--> statement-breakpoint
CREATE INDEX `created_at_idx` ON `games` (`created_at`);--> statement-breakpoint
CREATE INDEX `game_id_idx` ON `statistics` (`game_id`);--> statement-breakpoint
CREATE INDEX `date_idx` ON `statistics` (`date`);--> statement-breakpoint
CREATE INDEX `game_id_date_idx` ON `statistics` (`game_id`,`date`);