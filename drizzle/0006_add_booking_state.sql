CREATE TYPE "public"."booking_state" AS ENUM('idle', 'creating', 'confirmed', 'failed');--> statement-breakpoint
ALTER TABLE "interviews" ADD COLUMN "booking_state" "booking_state" DEFAULT 'idle' NOT NULL;--> statement-breakpoint
-- Existing events are already confirmed. A scheduled row without an event needs an explicit retry.
UPDATE "interviews" SET "booking_state" = 'confirmed' WHERE "graph_event_id" IS NOT NULL;--> statement-breakpoint
UPDATE "interviews" SET "booking_state" = 'failed'
WHERE "status" = 'scheduled' AND "graph_event_id" IS NULL;
