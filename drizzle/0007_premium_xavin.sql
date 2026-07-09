CREATE TABLE `earned_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`achievement_id` integer NOT NULL,
	`badge_name` text NOT NULL,
	`prestige_level` integer NOT NULL,
	`earned_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`achievement_id`) REFERENCES `task_achievements`(`id`) ON UPDATE no action ON DELETE cascade
);
