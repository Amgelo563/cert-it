CREATE TABLE `onboarding_steps` (
	`user_id` integer NOT NULL,
	`step` text NOT NULL,
	`completed_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `step`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_dismissed_at` integer;