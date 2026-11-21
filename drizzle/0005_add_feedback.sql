CREATE TYPE "public"."feedback_recommendation" AS ENUM('move_forward', 'hold', 'reject');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"panelist_id" text NOT NULL,
	"rating" integer NOT NULL,
	"recommendation" "feedback_recommendation" NOT NULL,
	"comments" text NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_interview_id_unique" UNIQUE("interview_id"),
	CONSTRAINT "feedback_rating_range" CHECK ("feedback"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "reminder_24_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "reminder_1_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "feedback_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_panelist_id_user_id_fk" FOREIGN KEY ("panelist_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_panelist_idx" ON "feedback" USING btree ("panelist_id");
--> statement-breakpoint
-- Private to the server, like every other table.
ALTER TABLE "feedback" ENABLE ROW LEVEL SECURITY;
