PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_task_achievements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`task_id` integer,
	`name` text NOT NULL,
	`target_streak` integer NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`prestige_count` integer DEFAULT 0 NOT NULL,
	`last_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_task_achievements`("id", "task_id", "name", "target_streak", "current_streak", "prestige_count", "last_completed_at", "created_at", "updated_at") SELECT "id", "task_id", "name", "target_streak", "current_streak", "prestige_count", "last_completed_at", "created_at", "updated_at" FROM `task_achievements`;--> statement-breakpoint
DROP TABLE `task_achievements`;--> statement-breakpoint
ALTER TABLE `__new_task_achievements` RENAME TO `task_achievements`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `task_achievements_task_id_unique` ON `task_achievements` (`task_id`);