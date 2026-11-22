CREATE TYPE "public"."booking_state" AS ENUM('idle', 'creating', 'confirmed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."calendar_state" AS ENUM('idle', 'rescheduling', 'cancelling');--> statement-breakpoint
CREATE TYPE "public"."delivery_kind" AS ENUM('reminder_24', 'reminder_1', 'feedback_request');--> statement-breakpoint
CREATE TYPE "public"."delivery_recipient" AS ENUM('recruiter', 'panelist', 'candidate');--> statement-breakpoint
CREATE TYPE "public"."delivery_state" AS ENUM('pending', 'processing', 'sent', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "interview_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interview_id" uuid NOT NULL,
	"kind" "delivery_kind" NOT NULL,
	"recipient" "delivery_recipient" NOT NULL,
	"schedule_revision" integer NOT NULL,
	"state" "delivery_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "booking_state" "booking_state" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
-- Existing Graph-backed events are confirmed. Unresolved scheduled rows need an explicit retry.
UPDATE "interviews" SET "booking_state" = 'confirmed' WHERE "graph_event_id" IS NOT NULL;--> statement-breakpoint
UPDATE "interviews" SET "booking_state" = 'failed'
WHERE "status" = 'scheduled' AND "graph_event_id" IS NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "calendar_state" "calendar_state" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "schedule_revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "delivery_id" uuid;--> statement-breakpoint
ALTER TABLE "interview_deliveries" ADD CONSTRAINT "interview_deliveries_interview_id_interviews_id_fk" FOREIGN KEY ("interview_id") REFERENCES "public"."interviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "interview_deliveries_once_uniq" ON "interview_deliveries" USING btree ("interview_id","kind","recipient","schedule_revision");--> statement-breakpoint
CREATE INDEX "interview_deliveries_due_idx" ON "interview_deliveries" USING btree ("state","available_at");--> statement-breakpoint
CREATE INDEX "interview_deliveries_interview_idx" ON "interview_deliveries" USING btree ("interview_id");--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_delivery_id_interview_deliveries_id_fk" FOREIGN KEY ("delivery_id") REFERENCES "public"."interview_deliveries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_delivery_id_unique" UNIQUE("delivery_id");
--> statement-breakpoint
ALTER TABLE "interview_deliveries" ENABLE ROW LEVEL SECURITY;
