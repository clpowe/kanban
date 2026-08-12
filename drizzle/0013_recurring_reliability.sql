CREATE TABLE `rollover_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`rollover_type` text NOT NULL,
	`cycle_key` text NOT NULL,
	`started_at` integer NOT NULL,
	`completed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rollover_runs_type_cycle_unique` ON `rollover_runs` (`rollover_type`,`cycle_key`);--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `recurrence_key` text;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `cadence` text;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `task_title` text;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `task_priority` text;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `task_value` integer;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `assignee_id` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `streak_enabled` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `task_achievements` ADD `active` integer DEFAULT true NOT NULL;--> statement-breakpoint
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
UPDATE `task_achievements`
SET
	`recurrence_key` = COALESCE(`recurrence_key`, 'legacy:' || `id`),
	`cadence` = COALESCE(
		`cadence`,
		(
			SELECT `tasks`.`repeat`
			FROM `tasks`
			WHERE (`tasks`.`achievement_id` = `task_achievements`.`id`
				OR `tasks`.`id` = `task_achievements`.`task_id`)
				AND `tasks`.`repeat` IN ('daily', 'weekly')
			ORDER BY (`tasks`.`status` = 'archived') ASC, `tasks`.`id` DESC
			LIMIT 1
		)
	),
	`task_title` = COALESCE(
		`task_title`,
		(
			SELECT `tasks`.`title`
			FROM `tasks`
			WHERE `tasks`.`achievement_id` = `task_achievements`.`id`
				OR `tasks`.`id` = `task_achievements`.`task_id`
			ORDER BY (`tasks`.`status` = 'archived') ASC, `tasks`.`id` DESC
			LIMIT 1
		)
	),
	`task_priority` = COALESCE(
		`task_priority`,
		(
			SELECT `tasks`.`priority`
			FROM `tasks`
			WHERE `tasks`.`achievement_id` = `task_achievements`.`id`
				OR `tasks`.`id` = `task_achievements`.`task_id`
			ORDER BY (`tasks`.`status` = 'archived') ASC, `tasks`.`id` DESC
			LIMIT 1
		)
	),
	`task_value` = COALESCE(
		`task_value`,
		(
			SELECT `tasks`.`value`
			FROM `tasks`
			WHERE `tasks`.`achievement_id` = `task_achievements`.`id`
				OR `tasks`.`id` = `task_achievements`.`task_id`
			ORDER BY (`tasks`.`status` = 'archived') ASC, `tasks`.`id` DESC
			LIMIT 1
		)
	),
	`assignee_id` = COALESCE(
		`assignee_id`,
		(
			SELECT `tasks`.`assignee_id`
			FROM `tasks`
			WHERE `tasks`.`achievement_id` = `task_achievements`.`id`
				OR `tasks`.`id` = `task_achievements`.`task_id`
			ORDER BY (`tasks`.`status` = 'archived') ASC, `tasks`.`id` DESC
			LIMIT 1
		)
	);--> statement-breakpoint
UPDATE `tasks`
SET `cycle_date` = CASE
	WHEN `repeat` = 'weekly' THEN date(
		'now',
		printf('-%d days', (CAST(strftime('%w', 'now') AS integer) + 6) % 7)
	)
	ELSE date('now')
END
WHERE `repeat` IN ('daily', 'weekly')
	AND `achievement_id` IS NOT NULL
	AND `status` <> 'archived'
	AND `cycle_date` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `task_achievements_recurrence_key_unique` ON `task_achievements` (`recurrence_key`);--> statement-breakpoint
CREATE INDEX `task_achievements_active_cadence_idx` ON `task_achievements` (`active`,`cadence`);--> statement-breakpoint
CREATE UNIQUE INDEX `earned_badges_completion_unique` ON `earned_badges` (`task_completion_id`) WHERE "earned_badges"."task_completion_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `tasks_one_active_achievement_unique` ON `tasks` (`achievement_id`) WHERE "tasks"."achievement_id" IS NOT NULL AND "tasks"."status" <> 'archived';--> statement-breakpoint
CREATE INDEX `tasks_active_cycle_idx` ON `tasks` (`status`,`cycle_date`);
