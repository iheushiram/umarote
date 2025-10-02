CREATE TABLE `track_condition_daily_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`venue` text NOT NULL,
	`meeting_label` text NOT NULL,
	`meeting_number` integer,
	`measurement_date` text NOT NULL,
	`day_of_week` text,
	`turf_goal_percent` real,
	`turf_corner_percent` real,
	`dirt_goal_percent` real,
	`dirt_corner_percent` real,
	`cushion_value` real,
	`source_file` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
