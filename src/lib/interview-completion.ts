import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, interviewDeliveries, interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";

type CompleteInterviewInput = {
  interviewId: string;
  actorId: string | null;
  panelistId?: string;
  completedAt?: Date;
  actualEndedAt?: Date;
  source?: "panelist" | "scheduler" | "teams_webhook";
  enqueueFeedbackRequest?: boolean;
};

/**
 * Moves one confirmed interview to completed in a single transaction.
 * When panelistId is supplied, ownership is checked in the winning UPDATE so a
 * Panelist can never complete somebody else's interview.
 */
export async function completeInterview({
  interviewId,
  actorId,
  panelistId,
  completedAt = new Date(),
  actualEndedAt,
  source,
  enqueueFeedbackRequest = false,
}: CompleteInterviewInput): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(interviews)
      .set({
        status: "completed",
        feedbackRequestedAt: completedAt,
        actualEndedAt: actualEndedAt ?? null,
        version: sql`${interviews.version} + 1`,
      })
      .where(
        and(
          eq(interviews.id, interviewId),
          eq(interviews.status, "scheduled"),
          eq(interviews.bookingState, "confirmed"),
          eq(interviews.calendarState, "idle"),
          panelistId ? eq(interviews.panelistId, panelistId) : undefined,
        ),
      )
      .returning({ candidateId: interviews.candidateId, scheduleRevision: interviews.scheduleRevision });
    if (!claimed) return false;

    await tx
      .update(candidates)
      .set({ stage: "interview_done" })
      .where(and(eq(candidates.id, claimed.candidateId), eq(candidates.stage, "interview_scheduled")));

    if (enqueueFeedbackRequest) {
      await tx
        .insert(interviewDeliveries)
        .values({
          interviewId,
          kind: "feedback_request",
          recipient: "panelist",
          scheduleRevision: claimed.scheduleRevision,
        })
        .onConflictDoNothing();
    }

    await logActivity(
      {
        actorId,
        action: "interview.completed",
        entityType: "interview",
        entityId: interviewId,
        details: { source: source ?? (actorId ? "panelist" : "scheduler") },
      },
      tx,
    );
    return true;
  });
}
