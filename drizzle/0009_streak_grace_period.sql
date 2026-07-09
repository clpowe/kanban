ALTER TABLE `task_achievements` ADD `missed_days_in_a_row` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `prev_streak` integer;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `prev_last_completed_at` integer;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `prev_missed_days_in_a_row` integer;
