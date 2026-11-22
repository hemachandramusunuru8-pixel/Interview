import "server-only";
import { and, eq, gt, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { feedbackRequestMail, reminderMail, type Details } from "@/lib/emails";
import { sendMail } from "@/lib/graph";
import { loadInterview, type InterviewContext } from "@/lib/interviews";
import { notifyUser } from "@/lib/notify";
import { syncRecordings } from "@/lib/recordings";

const HOUR = 60 * 60 * 1000;

function details(i: InterviewContext): Details {
  return {
    candidateName: i.candidate.name,
    jobTitle: i.job.title,
    round: i.interview.round,
    startsAt: i.interview.startsAt,
    timeZone: i.interview.timeZone,
  };
}

/**
 * Interviews whose end time has passed become "completed": the candidate moves to "Interview done"
 * and the panelist is asked for feedback. Each interview is claimed in a single UPDATE, so running
 * this twice (or from two places at once) never sends a second request.
 */
export async function completeEndedInterviews(now: Date = new Date()): Promise<number> {
  const claimed = await db
    .update(interviews)
    .set({ status: "completed", feedbackRequestedAt: now })
    .where(
      and(eq(interviews.status, "scheduled"), lt(interviews.endsAt, now), isNull(interviews.feedbackRequestedAt)),
    )
    .returning({ id: interviews.id, candidateId: interviews.candidateId });

  for (const { id, candidateId } of claimed) {
    try {
      await db
        .update(candidates)
        .set({ stage: "interview_done" })
        .where(and(eq(candidates.id, candidateId), eq(candidates.stage, "interview_scheduled")));

      const ctx = await loadInterview(id);
      if (ctx?.panelist) {
        const mail = feedbackRequestMail(ctx.panelist.name, id, details(ctx));
        await notifyUser({
          userId: ctx.panelist.id,
          email: ctx.panelist.email,
          subject: mail.subject,
          html: mail.html,
          title: "Please submit feedback",
          body: `${ctx.candidate.name} - ${ctx.job.title}, round ${ctx.interview.round}`,
          link: `/panelist/interviews/${id}/feedback`,
        });
      }
      await logActivity({ actorId: null, action: "interview.completed", entityType: "interview", entityId: id });
    } catch (err) {
      console.error("Completing interview failed:", id, err);
    }
  }
  return claimed.length;
}

async function sendReminder(interviewId: string) {
  const ctx = await loadInterview(interviewId);
  if (!ctx || !ctx.panelist) return;
  const d = details(ctx);
  const join = ctx.interview.teamsJoinUrl;

  for (const person of [ctx.recruiter, ctx.panelist]) {
    const mail = reminderMail(person.name, d, join);
    await notifyUser({
      userId: person.id,
      email: person.email,
      subject: mail.subject,
      html: mail.html,
      title: "Interview reminder",
      body: `${ctx.candidate.name} - ${ctx.job.title}, round ${ctx.interview.round}`,
      link: person.id === ctx.panelist.id ? "/panelist/interviews" : `/jobs/${ctx.job.id}/candidates/${ctx.candidate.id}/interviews`,
    });
  }
  // The candidate never logs in, so they only get the email.
  const candMail = reminderMail(ctx.candidate.name, d, join);
  try {
    await sendMail({ to: ctx.candidate.email, subject: candMail.subject, html: candMail.html });
  } catch (err) {
    console.error("Candidate reminder failed:", err);
  }
}

/**
 * Reminders for scheduled interviews: one within 24 hours, one within the final hour.
 * An interview booked late (inside the hour) gets a single reminder, not two.
 */
export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const in1h = new Date(now.getTime() + HOUR);
  const in24h = new Date(now.getTime() + 24 * HOUR);

  const dayBefore = await db
    .update(interviews)
    .set({ reminder24SentAt: now })
    .where(
      and(
        eq(interviews.status, "scheduled"),
        isNull(interviews.reminder24SentAt),
        gt(interviews.startsAt, in1h),
        lte(interviews.startsAt, in24h),
      ),
    )
    .returning({ id: interviews.id });

  const lastHour = await db
    .update(interviews)
    .set({ reminder1SentAt: now, reminder24SentAt: sql`coalesce(${interviews.reminder24SentAt}, ${now.toISOString()}::timestamptz)` })
    .where(
      and(
        eq(interviews.status, "scheduled"),
        isNull(interviews.reminder1SentAt),
        gt(interviews.startsAt, now),
        lte(interviews.startsAt, in1h),
      ),
    )
    .returning({ id: interviews.id });

  for (const { id } of [...dayBefore, ...lastHour]) {
    try {
      await sendReminder(id);
    } catch (err) {
      console.error("Reminder failed:", id, err);
    }
  }
  return dayBefore.length + lastHour.length;
}

export async function runDueJobs(now: Date = new Date()) {
  const completed = await completeEndedInterviews(now);
  const reminders = await sendDueReminders(now);
  // Teams recordings for interviews that ended recently are saved for Admins and Recruiters.
  const recordings = await syncRecordings({ now }).catch((err) => {
    console.error("Recording sync failed:", err);
    return { checked: 0, saved: 0, failed: 1 };
  });
  return { completed, reminders, recordings };
}
