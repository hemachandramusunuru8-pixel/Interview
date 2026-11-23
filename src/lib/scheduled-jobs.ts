import "server-only";
import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { interviewDeliveries, interviews, notifications } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { feedbackRequestMail, reminderMail, type Details } from "@/lib/emails";
import { sendMail } from "@/lib/graph";
import { ensureMeetingEventSubscriptions, processMeetingNotifications } from "@/lib/graph-meeting-events";
import { loadInterview, type InterviewContext } from "@/lib/interviews";
import { completeInterview } from "@/lib/interview-completion";
import { syncRecordings } from "@/lib/recordings";

const HOUR = 60 * 60 * 1000;
const DELIVERY_LEASE_MS = 5 * 60 * 1000;
const MAX_DELIVERY_ATTEMPTS = 8;

function details(i: InterviewContext): Details {
  return { candidateName: i.candidate.name, jobTitle: i.job.title, round: i.interview.round, startsAt: i.interview.startsAt, timeZone: i.interview.timeZone };
}

export async function completeEndedInterviews(now: Date = new Date()): Promise<number> {
  const webhookFallbackAt = new Date(now.getTime() - 6 * HOUR);
  const due = await db.select({ id: interviews.id }).from(interviews).where(and(
    eq(interviews.status, "scheduled"), eq(interviews.bookingState, "confirmed"), eq(interviews.calendarState, "idle"),
    or(
      and(isNull(interviews.graphCallSubscriptionId), lt(interviews.endsAt, now)),
      lt(interviews.endsAt, webhookFallbackAt),
    ),
    isNull(interviews.feedbackRequestedAt),
  )).limit(100);
  let completed = 0;
  for (const row of due) {
    const won = await completeInterview({
      interviewId: row.id,
      actorId: null,
      completedAt: now,
      enqueueFeedbackRequest: true,
    });
    if (won) completed++;
  }
  return completed;
}

export async function expirePastInterviews(now: Date = new Date()): Promise<number> {
  const due = await db.select({ id: interviews.id }).from(interviews)
    .where(and(eq(interviews.status, "pending"), eq(interviews.calendarState, "idle"), lte(interviews.startsAt, now)))
    .limit(100);
  if (!due.length) return 0;
  const expired = await db.update(interviews).set({ status: "cancelled", version: sql`${interviews.version} + 1` })
    .where(and(inArray(interviews.id, due.map((row) => row.id)), eq(interviews.status, "pending"), eq(interviews.calendarState, "idle"), lte(interviews.startsAt, now)))
    .returning({ id: interviews.id });
  for (const { id } of expired) {
    try { await logActivity({ actorId: null, action: "interview.expired", entityType: "interview", entityId: id }); }
    catch (err) { console.error("Logging expired interview failed:", id, err); }
  }
  return expired.length;
}

async function enqueueReminder(kind: "reminder_24" | "reminder_1", now: Date, from: Date, to: Date) {
  return db.transaction(async (tx) => {
    const marker = kind === "reminder_24"
      ? { reminder24SentAt: now }
      : { reminder1SentAt: now, reminder24SentAt: sql`coalesce(${interviews.reminder24SentAt}, ${now.toISOString()}::timestamptz)` };
    const markerColumn = kind === "reminder_24" ? interviews.reminder24SentAt : interviews.reminder1SentAt;
    const due = await tx.select({ id: interviews.id }).from(interviews).where(and(
      eq(interviews.status, "scheduled"), eq(interviews.bookingState, "confirmed"), eq(interviews.calendarState, "idle"),
      isNull(markerColumn), gt(interviews.startsAt, from), lte(interviews.startsAt, to),
    )).limit(100);
    if (!due.length) return 0;
    const claimed = await tx.update(interviews).set(marker).where(and(
      eq(interviews.status, "scheduled"), eq(interviews.bookingState, "confirmed"), eq(interviews.calendarState, "idle"),
      inArray(interviews.id, due.map((row) => row.id)), isNull(markerColumn), gt(interviews.startsAt, from), lte(interviews.startsAt, to),
    )).returning({ id: interviews.id, scheduleRevision: interviews.scheduleRevision });
    if (claimed.length) {
      await tx.insert(interviewDeliveries).values(claimed.flatMap((item) => (["recruiter", "panelist", "candidate"] as const).map((recipient) => ({
        interviewId: item.id, kind, recipient, scheduleRevision: item.scheduleRevision,
      })))).onConflictDoNothing();
    }
    return claimed.length;
  });
}

export async function sendDueReminders(now: Date = new Date()): Promise<number> {
  const in1h = new Date(now.getTime() + HOUR);
  const in24h = new Date(now.getTime() + 24 * HOUR);
  return await enqueueReminder("reminder_24", now, in1h, in24h) + await enqueueReminder("reminder_1", now, now, in1h);
}

type ClaimedDelivery = { id: string; interviewId: string; kind: "reminder_24" | "reminder_1" | "feedback_request"; recipient: "recruiter" | "panelist" | "candidate"; attempts: number };

async function claimDeliveries(now: Date, limit: number): Promise<ClaimedDelivery[]> {
  const stale = new Date(now.getTime() - DELIVERY_LEASE_MS);
  const result = await db.execute<ClaimedDelivery>(sql`
    with due as (
      select id from interview_deliveries
      where attempts < ${MAX_DELIVERY_ATTEMPTS} and available_at <= ${now}
        and (state in ('pending', 'failed') or (state = 'processing' and locked_at < ${stale}))
      order by available_at, created_at for update skip locked limit ${limit}
    )
    update interview_deliveries d
      set state = 'processing', locked_at = ${now}, attempts = d.attempts + 1, updated_at = ${now}
      from due where d.id = due.id
      returning d.id, d.interview_id as "interviewId", d.kind, d.recipient, d.attempts
  `);
  return result.rows;
}

async function deliver(item: ClaimedDelivery) {
  const ctx = await loadInterview(item.interviewId);
  if (!ctx || !ctx.panelist) throw new Error("Interview recipient context is unavailable");
  const d = details(ctx);
  const target = item.recipient === "recruiter" ? ctx.recruiter : item.recipient === "panelist" ? ctx.panelist : ctx.candidate;
  const mail = item.kind === "feedback_request" ? feedbackRequestMail(ctx.panelist.name, item.interviewId, d) : reminderMail(target.name, d, ctx.interview.teamsJoinUrl);
  if (item.recipient !== "candidate") {
    await db.insert(notifications).values({
      userId: target.id, title: item.kind === "feedback_request" ? "Please submit feedback" : "Interview reminder",
      body: `${ctx.candidate.name} - ${ctx.job.title}, round ${ctx.interview.round}`,
      link: item.kind === "feedback_request" ? `/panelist/interviews/${item.interviewId}/feedback`
        : item.recipient === "panelist" ? "/panelist/interviews" : `/jobs/${ctx.job.id}/candidates/${ctx.candidate.id}/interviews`,
      deliveryId: item.id,
    }).onConflictDoNothing();
  }
  await sendMail({ to: target.email, subject: mail.subject, html: mail.html });
}

export async function processInterviewDeliveries(now: Date = new Date(), limit = 50) {
  const claimed = await claimDeliveries(now, limit);
  let sent = 0;
  let failed = 0;
  for (const item of claimed) {
    try {
      await deliver(item);
      await db.update(interviewDeliveries).set({ state: "sent", sentAt: new Date(), lockedAt: null, lastError: null })
        .where(and(eq(interviewDeliveries.id, item.id), eq(interviewDeliveries.state, "processing")));
      sent++;
    } catch (err) {
      const delayMinutes = Math.min(60, 2 ** Math.min(item.attempts, 6));
      await db.update(interviewDeliveries).set({ state: "failed", lockedAt: null, availableAt: new Date(now.getTime() + delayMinutes * 60_000), lastError: err instanceof Error ? err.message.slice(0, 1000) : "Unknown delivery failure" })
        .where(and(eq(interviewDeliveries.id, item.id), eq(interviewDeliveries.state, "processing")));
      failed++;
    }
  }
  return { claimed: claimed.length, sent, failed };
}

export async function runDueJobs(now: Date = new Date()) {
  const expired = await expirePastInterviews(now);
  const meetingSubscriptions = await ensureMeetingEventSubscriptions(now).catch((err) => {
    console.error("Meeting-call subscription maintenance failed:", err);
    return { due: 0, active: 0, failed: 1 };
  });
  const meetingNotifications = await processMeetingNotifications(now).catch((err) => {
    console.error("Meeting-call notification processing failed:", err);
    return { claimed: 0, processed: 0, failed: 1 };
  });
  const completed = await completeEndedInterviews(now);
  const reminders = await sendDueReminders(now);
  const deliveries = await processInterviewDeliveries(now);
  const recordings = await syncRecordings({ now }).catch((err) => {
    console.error("Recording sync failed:", err);
    return { checked: 0, saved: 0, failed: 1 };
  });
  return { expired, meetingSubscriptions, meetingNotifications, completed, reminders, deliveries, recordings };
}
