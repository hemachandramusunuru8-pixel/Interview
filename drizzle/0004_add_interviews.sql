CREATE TYPE "public"."interview_mode" AS ENUM('direct', 'pipeline');--> statement-breakpoint
CREATE TYPE "public"."interview_status" AS ENUM('pending', 'scheduled', 'declined', 'cancelled', 'completed');--> statement-breakpoint
CREATE TABLE "interviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"mode" "interview_mode" DEFAULT 'direct' NOT NULL,
	"panelist_id" text,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"time_zone" text NOT NULL,
	"status" "interview_status" DEFAULT 'pending' NOT NULL,
	"decline_reason" text,
	"teams_join_url" text,
	"graph_event_id" text,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "interviews_round_positive" CHECK ("interviews"."round" >= 1),
	CONSTRAINT "interviews_ends_after_start" CHECK ("interviews"."ends_at" > "interviews"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"link" text,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "public"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_panelist_id_user_id_fk" FOREIGN KEY ("panelist_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interviews_active_candidate_round_uniq" ON "interviews" USING btree ("candidate_id","round") WHERE "interviews"."status" in ('pending', 'scheduled');--> statement-breakpoint
CREATE INDEX "interviews_panelist_idx" ON "interviews" USING btree ("panelist_id");--> statement-breakpoint
CREATE INDEX "interviews_candidate_idx" ON "interviews" USING btree ("candidate_id");--> statement-breakpoint
CREATE INDEX "interviews_status_idx" ON "interviews" USING btree ("status");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read_at");
--> statement-breakpoint
-- A panelist can never hold two live interviews that overlap in time. The database
-- enforces this, so two people booking at once cannot double-book (also used by pipeline scheduling).
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
--> statement-breakpoint
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_no_panelist_overlap"
  EXCLUDE USING gist ("panelist_id" WITH =, tstzrange("starts_at", "ends_at") WITH &&)
  WHERE ("status" IN ('pending', 'scheduled') AND "panelist_id" IS NOT NULL);
--> statement-breakpoint
-- Private to the server, like every other table.
ALTER TABLE "interviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
