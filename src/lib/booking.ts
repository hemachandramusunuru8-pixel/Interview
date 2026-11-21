import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { candidates, interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { eventBodyHtml, eventSubject, recruiterAcceptedMail, type Details } from "@/lib/emails";
import { createInterviewEvent } from "@/lib/graph";
import { loadInterview } from "@/lib/interviews";
import { notifyUser } from "@/lib/notify";

export type BookingResult = { ok: true } | { ok: false; error: string };

/**
 * Finishes a booking once a panelist is attached and the interview is marked "scheduled":
 * creates the Teams event (everyone gets the Outlook invite), saves the join link, moves the candidate
 * to "Interview scheduled" and tells the recruiter. Nothing is sent to anyone if the Teams step fails,
 * so the caller can safely undo the claim.
 */
export async function confirmBooking(interviewId: string, actorId: string, action: string): Promise<BookingResult> {
  const ctx = await loadInterview(interviewId);
  if (!ctx || !ctx.panelist) return { ok: false, error: "That interview no longer exists." };

  const d: Details = {
    candidateName: ctx.candidate.name,
    jobTitle: ctx.job.title,
    round: ctx.interview.round,
    startsAt: ctx.interview.startsAt,
    timeZone: ctx.interview.timeZone,
  };

  try {
    const event = await createInterviewEvent({
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
    await db
      .update(interviews)
      .set({ teamsJoinUrl: event.joinUrl, graphEventId: event.eventId })
      .where(eq(interviews.id, interviewId));
  } catch (err) {
    console.error("Teams event creation failed:", err);
    return { ok: false, error: "The Teams invite could not be created. Nothing was changed; please try again." };
  }

  await db.update(candidates).set({ stage: "interview_scheduled" }).where(eq(candidates.id, ctx.candidate.id));

  const mail = recruiterAcceptedMail(ctx.recruiter.name, ctx.panelist.name, d);
  await notifyUser({
    userId: ctx.recruiter.id,
    email: ctx.recruiter.email,
    subject: mail.subject,
    html: mail.html,
    title: "Interview confirmed",
    body: `${ctx.candidate.name} - ${ctx.job.title}, round ${ctx.interview.round}`,
    link: `/jobs/${ctx.job.id}/candidates/${ctx.candidate.id}/interviews`,
  });
  await logActivity({ actorId, action, entityType: "interview", entityId: interviewId });
  return { ok: true };
}
