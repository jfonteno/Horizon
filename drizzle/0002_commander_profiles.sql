CREATE TABLE IF NOT EXISTS `horizon_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`payload` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `horizon_accounts_token_hash_unique` ON `horizon_accounts` (`token_hash`);
