ALTER TABLE `users` ADD COLUMN `username` text;--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `password_hash` text;--> statement-breakpoint
UPDATE `users`
SET `username` = CASE
	WHEN lower(replace(`name`, ' ', '')) = '' THEN 'user-' || `id`
	ELSE lower(replace(`name`, ' ', ''))
END
WHERE `username` IS NULL;--> statement-breakpoint
UPDATE `users`
SET `password_hash` = 'pbkdf2$100000$8s3A+aASRVdGC8KK+JYKLg==$qbTL7YQ0WZzlbu+PV4FY3EoXjVkiLpmkPtzWUZ/cK4o='
WHERE `password_hash` IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
