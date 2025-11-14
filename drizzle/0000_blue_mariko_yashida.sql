CREATE TYPE "public"."event_format" AS ENUM('conference', 'talk', 'hangout', 'meeting', 'external_speaker', 'newsletter', 'social_media_takeover', 'workshop', 'panel', 'others');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('planning', 'published', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'in_progress', 'complete');--> statement-breakpoint
CREATE TYPE "public"."volunteer_status" AS ENUM('probation', 'full', 'lead');--> statement-breakpoint
CREATE TABLE "admins" (
	"id" serial PRIMARY KEY NOT NULL,
	"telegram_handle" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "admins_telegram_handle_unique" UNIQUE("telegram_handle")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"format" "event_format" NOT NULL,
	"status" "event_status" DEFAULT 'planning' NOT NULL,
	"venue" text,
	"details" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "task_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer,
	"volunteer_id" integer,
	"assigned_by" integer,
	"assigned_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer,
	"title" text NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'todo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "volunteers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"telegram_handle" text NOT NULL,
	"status" "volunteer_status" DEFAULT 'probation' NOT NULL,
	"commitments" integer DEFAULT 0 NOT NULL,
	"probation_start_date" timestamp with time zone DEFAULT now(),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "volunteers_telegram_handle_unique" UNIQUE("telegram_handle")
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_volunteers_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_task_id_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_volunteer_id_volunteers_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "public"."volunteers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignments" ADD CONSTRAINT "task_assignments_assigned_by_volunteers_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."volunteers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_admins_telegram_handle" ON "admins" USING btree ("telegram_handle");--> statement-breakpoint
CREATE INDEX "idx_events_date" ON "events" USING btree ("date");--> statement-breakpoint
CREATE INDEX "idx_events_status" ON "events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_events_created_by" ON "events" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "idx_task_assignments_task_id" ON "task_assignments" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX "idx_task_assignments_volunteer_id" ON "task_assignments" USING btree ("volunteer_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_event_id" ON "tasks" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_volunteers_telegram_handle" ON "volunteers" USING btree ("telegram_handle");--> statement-breakpoint
CREATE INDEX "idx_volunteers_status" ON "volunteers" USING btree ("status");