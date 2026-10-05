ALTER TABLE "events" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."event_format";--> statement-breakpoint
CREATE TYPE "public"."event_format" AS ENUM('moderated_discussion', 'conference', 'talk', 'hangout', 'meeting', 'external_speaker', 'newsletter', 'social_media_campaign', 'coding_project', 'workshop', 'panel', 'others');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "format" SET DATA TYPE "public"."event_format" USING "format"::"public"."event_format";--> statement-breakpoint
ALTER TABLE "volunteers" ADD COLUMN "cumulative_commitments" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE "volunteers" SET "cumulative_commitments" = "commitments";