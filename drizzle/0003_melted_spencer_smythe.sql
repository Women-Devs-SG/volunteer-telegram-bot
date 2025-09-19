ALTER TABLE "volunteers" RENAME COLUMN "probation_start_date" TO "commit_count_start_date";--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "probation_end_date" timestamp with time zone;