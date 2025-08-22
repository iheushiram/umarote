PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_race_results` (
	`id` text PRIMARY KEY NOT NULL,
	`race_id` text NOT NULL,
	`horse_id` text NOT NULL,
	`date` text NOT NULL,
	`race_name` text NOT NULL,
	`venue` text NOT NULL,
	`course_type` text NOT NULL,
	`distance` integer NOT NULL,
	`direction` text NOT NULL,
	`course_conf` text,
	`weather` text,
	`course_condition` text NOT NULL,
	`cushion_value` real,
	`finish_position` integer,
	`jockey` text NOT NULL,
	`weight` real NOT NULL,
	`time` text NOT NULL,
	`margin` text NOT NULL,
	`pos2c` integer,
	`pos3c` integer,
	`pos4c` integer,
	`average_position` real NOT NULL,
	`last_three_furlong` text NOT NULL,
	`odds` real NOT NULL,
	`popularity` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`race_id`) REFERENCES `races`(`race_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`horse_id`) REFERENCES `horses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_race_results`("id", "race_id", "horse_id", "date", "race_name", "venue", "course_type", "distance", "direction", "course_conf", "weather", "course_condition", "cushion_value", "finish_position", "jockey", "weight", "time", "margin", "pos2c", "pos3c", "pos4c", "average_position", "last_three_furlong", "odds", "popularity", "created_at", "updated_at") SELECT "id", "race_id", "horse_id", "date", "race_name", "venue", "course_type", "distance", "direction", "course_conf", "weather", "course_condition", "cushion_value", "finish_position", "jockey", "weight", "time", "margin", "pos2c", "pos3c", "pos4c", "average_position", "last_three_furlong", "odds", "popularity", "created_at", "updated_at" FROM `race_results`;--> statement-breakpoint
DROP TABLE `race_results`;--> statement-breakpoint
ALTER TABLE `__new_race_results` RENAME TO `race_results`;--> statement-breakpoint
PRAGMA foreign_keys=ON;