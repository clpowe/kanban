CREATE TABLE `__new_tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`priority` text NOT NULL,
	`value` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'todo',
	`repeat` text DEFAULT 'none',
	`assignee_id` integer,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_tasks` (`id`, `title`, `priority`, `value`, `status`, `repeat`, `assignee_id`)
SELECT `id`, `title`, `priority`, `value`, `status`, `repeat`, `assignee_id`
FROM `tasks`;
--> statement-breakpoint
DROP TABLE `tasks`;
--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;
