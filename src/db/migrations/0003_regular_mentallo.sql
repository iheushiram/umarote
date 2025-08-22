PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_horses` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`birth_date` text NOT NULL,
	`sex` text NOT NULL,
	`color` text NOT NULL,
	`father` text NOT NULL,
	`mother` text NOT NULL,
	`trainer` text NOT NULL,
	`owner` text NOT NULL,
	`breeder` text NOT NULL,
	`earnings` real DEFAULT 0 NOT NULL,
	`current_race_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_horses`("id", "name", "birth_date", "sex", "color", "father", "mother", "trainer", "owner", "breeder", "earnings", "current_race_id", "created_at", "updated_at") SELECT "id", "name", CAST("birth_year" AS TEXT), "sex", "color", "father", "mother", "trainer", "owner", "breeder", "earnings", "current_race_id", "created_at", "updated_at" FROM `horses`;--> statement-breakpoint
DROP TABLE `horses`;--> statement-breakpoint
ALTER TABLE `__new_horses` RENAME TO `horses`;--> statement-breakpoint
PRAGMA foreign_keys=ON;