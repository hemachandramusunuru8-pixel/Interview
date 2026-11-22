CREATE TABLE "interview_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"graph_recording_id" text NOT NULL,
	"meeting_id" text NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"discovered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "interview_recordings_graph_recording_id_unique" UNIQUE("graph_recording_id")
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "online_meeting_id" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "recordings_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interview_recordings" ADD CONSTRAINT "interview_recordings_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "interview_recordings_interview_idx" ON "interview_recordings" USING btree ("interview_id");
--> statement-breakpoint
-- Private to the server, like every other table.
ALTER TABLE "interview_recordings" ENABLE ROW LEVEL SECURITY;
