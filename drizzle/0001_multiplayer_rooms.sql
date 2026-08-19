CREATE TABLE IF NOT EXISTS `horizon_rooms` (
  `code` text PRIMARY KEY NOT NULL,
  `payload` text NOT NULL,
  `revision` integer NOT NULL,
  `updated_at` text NOT NULL
);
