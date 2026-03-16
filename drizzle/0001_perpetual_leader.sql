CREATE TABLE `rewards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`priority` text NOT NULL,
	`value` integer NOT NULL,
	`status` text DEFAULT 'todo',
	`repeat` text DEFAULT 'none',
	`assignee_id` integer,
	FOREIGN KEY (`assignee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
DROP INDEX `users_email_unique`;--> statement-breakpoint
ALTER TABLE `users` ADD `points` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `users` ADD `type` text NOT NULL;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `email`;