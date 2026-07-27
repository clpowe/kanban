CREATE TABLE `point_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`user_id` integer NOT NULL,
	`delta` integer NOT NULL,
	`reason` text NOT NULL,
	`task_completion_id` integer,
	`task_id` integer,
	`achievement_id` integer,
	`reward_id` integer,
	`reverses_entry_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_completion_id`) REFERENCES `task_completions`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`achievement_id`) REFERENCES `task_achievements`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reward_id`) REFERENCES `rewards`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`reverses_entry_id`) REFERENCES `point_entries`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_entries_event_unique` ON `point_entries` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `point_entries_one_reversal_unique` ON `point_entries` (`reverses_entry_id`) WHERE "point_entries"."reverses_entry_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX `point_entries_user_idx` ON `point_entries` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `task_completions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`task_id` integer,
	`achievement_id` integer,
	`user_id` integer NOT NULL,
	`completed_on` text NOT NULL,
	`completed_at` integer NOT NULL,
	`canceled_at` integer,
	`cancel_reason` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`achievement_id`) REFERENCES `task_achievements`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_completions_event_unique` ON `task_completions` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `task_completions_active_achievement_day_unique` ON `task_completions` (`achievement_id`,`completed_on`) WHERE "task_completions"."achievement_id" IS NOT NULL AND "task_completions"."canceled_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `task_completions_active_task_unique` ON `task_completions` (`task_id`) WHERE "task_completions"."achievement_id" IS NULL AND "task_completions"."task_id" IS NOT NULL AND "task_completions"."canceled_at" IS NULL;--> statement-breakpoint
CREATE INDEX `task_completions_user_idx` ON `task_completions` (`user_id`,`completed_on`);--> statement-breakpoint
CREATE INDEX `task_completions_achievement_idx` ON `task_completions` (`achievement_id`,`completed_on`);--> statement-breakpoint
ALTER TABLE `earned_badges` ADD `task_completion_id` integer REFERENCES task_completions(id) ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE `earned_badges` ADD `revoked_at` integer;--> statement-breakpoint
ALTER TABLE `earned_badges` ADD `revoked_reason` text;
