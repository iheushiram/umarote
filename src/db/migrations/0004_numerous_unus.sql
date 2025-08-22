PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_race_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`horse_id` text NOT NULL,
	`frame_no` integer NOT NULL,
	`horse_no` integer NOT NULL,
	`age` integer NOT NULL,
	`jockey` text NOT NULL,
	`weight` real NOT NULL,
	`trainer` text NOT NULL,
	`affiliation` text NOT NULL,
	`popularity` integer,
	`body_weight` integer,
	`body_weight_diff` integer,
	`blinkers` integer DEFAULT false,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_race_entries`("id", "race_id", "horse_id", "frame_no", "horse_no", "age", "jockey", "weight", "trainer", "affiliation", "popularity", "body_weight", "body_weight_diff", "blinkers", "created_at", "updated_at") SELECT "id", "race_id", "horse_id", "frame_no", "horse_no", "age", "jockey", "weight", "trainer", "affiliation", "popularity", "body_weight", "body_weight_diff", "blinkers", "created_at", "updated_at" FROM `race_entries`;--> statement-breakpoint
DROP TABLE `race_entries`;--> statement-breakpoint
ALTER TABLE `__new_race_entries` RENAME TO `race_entries`;--> statement-breakpoint
PRAGMA foreign_keys=ON;