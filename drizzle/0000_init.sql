CREATE TABLE `apps` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`purpose` text NOT NULL,
	`inspired_by` text NOT NULL,
	`categories` text NOT NULL,
	`description` text NOT NULL,
	`does` text NOT NULL,
	`handled` text NOT NULL,
	`leaves_out` text NOT NULL,
	`needs` text NOT NULL,
	`install_url` text NOT NULL,
	`repo_url` text NOT NULL,
	`published` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `apps_org_slug` ON `apps` (`org_id`,`slug`);--> statement-breakpoint
CREATE INDEX `apps_org_host` ON `apps` (`org_id`,`inspired_by`);--> statement-breakpoint
CREATE TABLE `requests` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`host` text NOT NULL,
	`url` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`requester_id` text NOT NULL,
	`app_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`requester_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `requests_org_host` ON `requests` (`org_id`,`host`);--> statement-breakpoint
CREATE INDEX `requests_org_status` ON `requests` (`org_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`org_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
