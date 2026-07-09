ALTER TABLE `tasks` ADD `achievement_id` integer REFERENCES task_achievements(id);--> statement-breakpoint
ALTER TABLE `tasks` ADD `cycle_date` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `completed_at` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `archive_reason` text;--> statement-breakpoint
UPDATE `tasks`
SET `achievement_id` = (
	SELECT `task_achievements`.`id`
	FROM `task_achievements`
	WHERE `task_achievements`.`task_id` = `tasks`.`id`
)
WHERE `tasks`.`repeat` IN ('daily', 'weekly')
	AND `tasks`.`achievement_id` IS NULL
	AND EXISTS (
		SELECT 1
		FROM `task_achievements`
		WHERE `task_achievements`.`task_id` = `tasks`.`id`
	);--> statement-breakpoint
INSERT INTO `task_achievements` (
	`task_id`,
	`name`,
	`target_streak`,
	`current_streak`,
	`prestige_count`,
	`created_at`,
	`updated_at`
)
SELECT
	`tasks`.`id`,
	`tasks`.`title` || ' Streak',
	20,
	0,
	0,
	CAST(strftime('%s', 'now') AS integer) * 1000,
	CAST(strftime('%s', 'now') AS integer) * 1000
FROM `tasks`
WHERE `tasks`.`repeat` IN ('daily', 'weekly')
	AND NOT EXISTS (
		SELECT 1
		FROM `task_achievements`
		WHERE `task_achievements`.`task_id` = `tasks`.`id`
	);--> statement-breakpoint
UPDATE `tasks`
SET `achievement_id` = (
	SELECT `task_achievements`.`id`
	FROM `task_achievements`
	WHERE `task_achievements`.`task_id` = `tasks`.`id`
)
WHERE `tasks`.`repeat` IN ('daily', 'weekly')
	AND `tasks`.`achievement_id` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_achievement_cycle_unique` ON `tasks` (`achievement_id`,`cycle_date`);
