CREATE TYPE "public"."graph_notification_state" AS ENUM('pending', 'processing', 'processed', 'failed');--> statement-breakpoint
CREATE TABLE "graph_meeting_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subscription_id" text NOT NULL,
	"notification_id" text,
	"payload" jsonb NOT NULL,
	"state" "graph_notification_state" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "graph_meeting_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "graph_call_subscription_id" text;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "graph_call_subscription_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "graph_call_subscription_locked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "actual_ended_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "graph_meeting_notifications_once_uniq" ON "graph_meeting_notifications" USING btree ("subscription_id","notification_id") WHERE "graph_meeting_notifications"."notification_id" is not null;--> statement-breakpoint
CREATE INDEX "graph_meeting_notifications_due_idx" ON "graph_meeting_notifications" USING btree ("state","available_at");--> statement-breakpoint
CREATE UNIQUE INDEX "interviews_graph_call_subscription_uniq" ON "interviews" USING btree ("graph_call_subscription_id") WHERE "interviews"."graph_call_subscription_id" is not null;
