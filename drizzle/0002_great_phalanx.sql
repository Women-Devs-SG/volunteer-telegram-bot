ALTER TABLE "volunteers" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "volunteers" ALTER COLUMN "status" SET DEFAULT 'probation'::text;--> statement-breakpoint
DROP TYPE "public"."volunteer_status";--> statement-breakpoint
CREATE TYPE "public"."volunteer_status" AS ENUM('probation', 'active', 'lead', 'inactive');--> statement-breakpoint
ALTER TABLE "volunteers" ALTER COLUMN "status" SET DEFAULT 'probation'::"public"."volunteer_status";--> statement-breakpoint
ALTER TABLE "volunteers" ALTER COLUMN "status" SET DATA TYPE "public"."volunteer_status" USING "status"::"public"."volunteer_status";