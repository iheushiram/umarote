CREATE TABLE `track_condition_details` (
	`id` text PRIMARY KEY NOT NULL,
	`meeting_number` integer NOT NULL,
	`day_number` integer,
	`measurement_date` text NOT NULL,
	`day_of_week` text NOT NULL,
	`venue` text NOT NULL,
	`turf_course_used` text,
	`turf_cushion_measurement_time` text,
	`turf_cushion_value` real,
	`moisture_measurement_time` text,
	`turf_moisture_before_goal` real,
	`turf_moisture_4th_corner` real,
	`dirt_moisture_before_goal` real,
	`dirt_moisture_4th_corner` real,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
