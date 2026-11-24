CREATE TABLE `retired_status_indexes` (
	`status_index` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
-- deleted certificates read as revoked at their ID, so those IDs stay retired
INSERT INTO `retired_status_indexes` (`status_index`)
WITH RECURSIVE `ids`(`n`) AS (
	SELECT 1 WHERE (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'certificates') >= 1
	UNION ALL
	SELECT `n` + 1 FROM `ids` WHERE `n` < (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'certificates')
)
SELECT `n` FROM `ids` WHERE `n` NOT IN (SELECT `id` FROM `certificates`);--> statement-breakpoint
CREATE TABLE `__new_certificates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`status_index` integer NOT NULL,
	`course_id` integer NOT NULL,
	`participant_id` integer NOT NULL,
	`template_version_id` integer NOT NULL,
	`issue_date` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`revoked_at` integer,
	`revoked_reason` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`participant_id`) REFERENCES `participants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_version_id`) REFERENCES `template_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
-- issued credentials already carry the ID as their index
INSERT INTO `__new_certificates` (`id`, `code`, `status_index`, `course_id`, `participant_id`, `template_version_id`, `issue_date`, `status`, `revoked_at`, `revoked_reason`, `created_at`, `updated_at`)
SELECT `id`, `code`, `id`, `course_id`, `participant_id`, `template_version_id`, `issue_date`, `status`, `revoked_at`, `revoked_reason`, `created_at`, `updated_at` FROM `certificates`;--> statement-breakpoint
DROP TABLE `certificates`;--> statement-breakpoint
ALTER TABLE `__new_certificates` RENAME TO `certificates`;--> statement-breakpoint
-- keeps IDs from being reused, as before
DELETE FROM `sqlite_sequence` WHERE `name` = 'certificates';--> statement-breakpoint
INSERT INTO `sqlite_sequence` (`name`, `seq`)
SELECT 'certificates', `n` FROM (
	SELECT MAX(`n`) AS `n` FROM (
		SELECT `id` AS `n` FROM `certificates`
		UNION ALL
		SELECT `status_index` FROM `retired_status_indexes`
	)
) WHERE `n` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_code_unique` ON `certificates` (`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_status_index_unique` ON `certificates` (`status_index`);--> statement-breakpoint
CREATE UNIQUE INDEX `certificates_participant_id_unique` ON `certificates` (`participant_id`);--> statement-breakpoint
CREATE INDEX `certificates_course_id_index` ON `certificates` (`course_id`);--> statement-breakpoint
CREATE INDEX `certificates_template_version_id_index` ON `certificates` (`template_version_id`);--> statement-breakpoint
CREATE TRIGGER `certificates_retire_status_index` AFTER DELETE ON `certificates`
BEGIN
	INSERT INTO `retired_status_indexes` (`status_index`) VALUES (OLD.`status_index`);
END;--> statement-breakpoint
CREATE TRIGGER `certificates_status_version_insert` AFTER INSERT ON `certificates`
BEGIN
	UPDATE `certificate_status_version` SET `version` = `version` + 1 WHERE `id` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `certificates_status_version_update` AFTER UPDATE OF `status` ON `certificates`
WHEN OLD.`status` IS NOT NEW.`status`
BEGIN
	UPDATE `certificate_status_version` SET `version` = `version` + 1 WHERE `id` = 1;
END;--> statement-breakpoint
CREATE TRIGGER `certificates_status_version_delete` AFTER DELETE ON `certificates`
BEGIN
	UPDATE `certificate_status_version` SET `version` = `version` + 1 WHERE `id` = 1;
END;
