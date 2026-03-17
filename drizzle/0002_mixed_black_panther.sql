PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "name", "points", "type") SELECT "id", "name", "points", "type" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
