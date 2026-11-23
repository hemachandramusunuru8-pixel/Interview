import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { eventBodyHtml, eventSubject, recruiterAcceptedMail, type Details } from "@/lib/emails";
import { createInterviewEvent, getInterviewEvent } from "@/lib/graph";
import { ensureMeetingEventSubscription } from "@/lib/graph-meeting-events";
import { loadInterview } from "@/lib/interviews";
import { notifyUser } from "@/lib/notify";

export type BookingResult = { ok: true } | { ok: false; error: string };
export const BOOKING_STALE_MS = 2 * 60 * 1000;

/**
 * Finishes a claimed booking. Graph retries use the interview id as their transaction id; known events
 * are reloaded instead of created again. The claim stays with the panelist until the Teams event is
 * confirmed, so an uncertain external result cannot be handed to somebody else.
 */
export async function confirmBooking(interviewId: string, actorId: string, action: string): Promise<BookingResult> {
  const ctx = await loadInterview(interviewId);
  if (!ctx || !ctx.panelist) return { ok: false, error: "That interview no longer exists." };
  if (ctx.interview.status !== "scheduled" || ctx.interview.bookingState !== "creating") {
    return { ok: false, error: "This booking is no longer waiting for a Teams invite." };
  }
  if (ctx.interview.calendarState !== "idle") return { ok: false, error: "A calendar change is already in progress." };

  const d: Details = {
    candidateName: ctx.candidate.name,
    jobTitle: ctx.job.title,
    round: ctx.interview.round,
    startsAt: ctx.interview.startsAt,
    timeZone: ctx.interview.timeZone,
  };

  let event: Awaited<ReturnType<typeof createInterviewEvent>>;
  try {
    event = ctx.interview.graphEventId
      ? await getInterviewEvent(ctx.interview.graphEventId)
      : await createInterviewEvent({
          // Graph uses this stable identifier to return the same event when a timed-out request is retried.
          transactionId: interviewId,
          subject: eventSubject(d),
          html: eventBodyHtml({ ...d, panelistName: ctx.panelist.name }),
          startsAt: ctx.interview.startsAt,
          endsAt: ctx.interview.endsAt,
          attendees: [
            { name: ctx.recruiter.name, email: ctx.recruiter.email },
            { name: ctx.panelist.name, email: ctx.panelist.email },
            { name: ctx.candidate.name, email: ctx.candidate.email },
          ],
        });
  } catch (err) {
    console.error("Teams event creation failed:", err);
    await db
      .update(interviews)
      .set({ bookingState: "failed", version: sql`${interviews.version} + 1` })
      .where(
        and(
          eq(interviews.id, interviewId),
          eq(interviews.status, "scheduled"),
          eq(interviews.bookingState, "creating"),
          eq(interviews.calendarState, "idle"),
        ),
      );
    return { ok: false, error: "The interview is reserved for you, but the Teams invite could not be created. Retry it from My interviews." };
  }

  if (!event.joinUrl) {
    await db
      .update(interviews)
      .set({ graphEventId: event.eventId, bookingState: "failed", version: sql`${interviews.version} + 1` })
      .where(
        and(
          eq(interviews.id, interviewId),
          eq(interviews.status, "scheduled"),
          eq(interviews.bookingState, "creating"),
          eq(interviews.calendarState, "idle"),
        ),
      );
    return { ok: false, error: "Microsoft created the calendar event without a Teams link. Retry it from My interviews." };
  }

  try {
    await db.transaction(async (tx) => {
      const [confirmed] = await tx
        .update(interviews)
        .set({ teamsJoinUrl: event.joinUrl, graphEventId: event.eventId, bookingState: "confirmed", version: sql`${interviews.version} + 1` })
        .where(
          and(
            eq(interviews.id, interviewId),
            eq(interviews.status, "scheduled"),
            eq(interviews.bookingState, "creating"),
            eq(interviews.calendarState, "idle"),
          ),
        )
        .returning({ id: interviews.id });
      if (!confirmed) throw new Error("BOOKING_SUPERSEDED");

      await tx.update(candidates).set({ stage: "interview_scheduled" }).where(eq(candidates.id, ctx.candidate.id));
      await logActivity({ actorId, action, entityType: "interview", entityId: interviewId }, tx);
    });
  } catch (err) {
    console.error("Saving Teams event failed:", err);
    await db
      .update(interviews)
      .set({ graphEventId: event.eventId, teamsJoinUrl: event.joinUrl, bookingState: "failed", version: sql`${interviews.version} + 1` })
      .where(
        and(
          eq(interviews.id, interviewId),
          eq(interviews.status, "scheduled"),
          eq(interviews.bookingState, "creating"),
          eq(interviews.calendarState, "idle"),
        ),
      );
    return { ok: false, error: "The Teams event exists, but the booking could not be finalized. Retry it from My interviews." };
  }

  try {
    await ensureMeetingEventSubscription(interviewId);
  } catch (err) {
    // The booking is valid. The cron worker will retry subscription setup/renewal.
    console.error("Teams call-ended subscription setup failed:", interviewId, err);
  }

  const mail = recruiterAcceptedMail(ctx.recruiter.name, ctx.panelist.name, d);
  try {
    await notifyUser({
      userId: ctx.recruiter.id,
      email: ctx.recruiter.email,
      subject: mail.subject,
      html: mail.html,
      title: "Interview confirmed",
      body: `${ctx.candidate.name} - ${ctx.job.title}, round ${ctx.interview.round}`,
      link: `/jobs/${ctx.job.id}/candidates/${ctx.candidate.id}/interviews`,
    });
  } catch (err) {
    // The calendar and local booking are already confirmed; notification recovery is handled separately.
    console.error("Recruiter booking notification failed:", err);
  }
  return { ok: true };
}
