CREATE TABLE `certificate_status_version` (
	`id` integer PRIMARY KEY NOT NULL,
	`version` integer DEFAULT 0 NOT NULL,
	CONSTRAINT "certificate_status_version_single_row" CHECK("certificate_status_version"."id" = 1)
);
--> statement-breakpoint
INSERT INTO `certificate_status_version` (`id`, `version`) VALUES (1, 0);--> statement-breakpoint
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
