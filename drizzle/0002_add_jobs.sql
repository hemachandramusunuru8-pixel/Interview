CREATE TYPE "public"."job_status" AS ENUM('open', 'on_hold', 'closed');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"department" text NOT NULL,
	"description" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"rounds" integer NOT NULL,
	"status" "job_status" DEFAULT 'open' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_rounds_range" CHECK ("jobs"."rounds" between 1 and 10)
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "jobs_created_by_idx" ON "jobs" USING btree ("created_by");
--> statement-breakpoint
-- Private to the server, like every other table: no policies, so the Data API roles see nothing.
ALTER TABLE "jobs" ENABLE ROW LEVEL SECURITY;
