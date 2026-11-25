CREATE TABLE `course_fields` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`course_id` integer NOT NULL,
	`label` text NOT NULL,
	`label_key` text NOT NULL,
	`type` text NOT NULL,
	`required` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `course_fields_course_id_label_key_unique` ON `course_fields` (`course_id`,`label_key`);--> statement-breakpoint
ALTER TABLE `participants` RENAME COLUMN `extra` TO `field_values`;--> statement-breakpoint
UPDATE `participants` SET `field_values` = '{}';
