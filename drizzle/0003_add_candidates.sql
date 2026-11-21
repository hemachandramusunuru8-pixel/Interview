CREATE TYPE "public"."candidate_stage" AS ENUM('uploaded', 'interview_scheduled', 'interview_done', 'next_round', 'selected', 'rejected');--> statement-breakpoint
CREATE TABLE "candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"experience_years" integer NOT NULL,
	"current_company" text,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"resume_path" text NOT NULL,
	"resume_filename" text NOT NULL,
	"stage" "candidate_stage" DEFAULT 'uploaded' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "candidates_experience_range" CHECK ("candidates"."experience_years" between 0 and 60)
);
--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "candidates_job_email_uniq" ON "candidates" USING btree ("job_id","email");--> statement-breakpoint
CREATE INDEX "candidates_job_idx" ON "candidates" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "candidates_stage_idx" ON "candidates" USING btree ("stage");
--> statement-breakpoint
-- Private to the server, like every other table.
ALTER TABLE "candidates" ENABLE ROW LEVEL SECURITY;
