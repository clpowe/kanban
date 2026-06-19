CREATE TABLE `task_achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer NOT NULL,
	`name` text NOT NULL,
	`target_streak` integer NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`prestige_count` integer DEFAULT 0 NOT NULL,
	`last_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_achievements_task_id_unique` ON `task_achievements` (`task_id`);