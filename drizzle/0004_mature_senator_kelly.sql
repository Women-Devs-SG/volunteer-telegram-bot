CREATE TABLE "admin_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"admin_handle" text,
	"admin_telegram_id" text,
	"chat_id" text,
	"message_id" text,
	"command" text NOT NULL,
	"args_raw" text,
	"result" text NOT NULL,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "format" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."event_format";--> statement-breakpoint
CREATE TYPE "public"."event_format" AS ENUM('moderated_discussion', 'conference', 'talk', 'hangout', 'meeting', 'external_speaker', 'newsletter', 'social_media_campaign', 'coding_project', 'workshop', 'panel', 'others');--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "format" SET DATA TYPE "public"."event_format" USING "format"::"public"."event_format";--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_admin_handle" ON "admin_audit_logs" USING btree ("admin_handle");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_command" ON "admin_audit_logs" USING btree ("command");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_result" ON "admin_audit_logs" USING btree ("result");--> statement-breakpoint
CREATE INDEX "idx_admin_audit_logs_timestamp" ON "admin_audit_logs" USING btree ("timestamp");