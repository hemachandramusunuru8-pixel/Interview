"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, feedback, interviewDeliveries, interviews, jobs, user } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireAnyRole } from "@/lib/dal";
import { openSlotMail, outcomeMail, panelistCancelledMail, panelistRescheduledMail, panelistRequestMail, type Details } from "@/lib/emails";
import { OUTCOME_STAGE, OUTCOME_LABEL, allowedOutcomes } from "@/lib/outcomes";
import { cancelInterviewEvent, rescheduleInterviewEvent, sendMail } from "@/lib/graph";
import { completedRounds, isOverlap, isUniqueViolation, loadInterview, type InterviewContext } from "@/lib/interviews";
import { announceWaitingCandidate, notifyAllPanelists, notifyUser } from "@/lib/notify";
import { pipelineEligibility } from "@/lib/pipeline";
import { INTERVIEW_STATUS_LABEL, futureSlot, scheduleSchema } from "@/lib/validation/interview";

export type InterviewFormState = { error?: string; ok?: string };

const ROLES = ["admin", "recruiter"] as const;
const OVERLAP_MSG = "That panelist already has an interview at that time. Choose another time or panelist.";

function details(i: InterviewContext): Details {
  return {
    candidateName: i.candidate.name,
    jobTitle: i.job.title,
    round: i.interview.round,
    startsAt: i.interview.startsAt,
    timeZone: i.interview.timeZone,
  };
}

export async function scheduleInterviewAction(
  _prev: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const { user: actor } = await requireAnyRole(ROLES);
  const raw = Object.fromEntries(formData);

  const ids = scheduleSchema.safeParse(raw);
  if (!ids.success) return { error: ids.error.issues[0].message };
  const slot = futureSlot().safeParse(raw);
  if (!slot.success) return { error: slot.error.issues[0].message };
  const { candidateId, jobId, panelistId } = ids.data;

  const [cand] = await db
    .select({ id: candidates.id, name: candidates.name, stage: candidates.stage })
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId)));
  if (!cand) return { error: "That candidate no longer exists." };

  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job || job.status !== "open") return { error: "Interviews can only be booked for an open job." };
  if (cand.stage !== "uploaded" && cand.stage !== "next_round") {
    return { error: "This candidate cannot be scheduled right now." };
  }

  const round = (await completedRounds(candidateId)) + 1;
  if (round > job.rounds) return { error: "This candidate has finished every round of the job." };

  const [pan] = await db.select().from(user).where(eq(user.id, panelistId));
  if (!pan || pan.role !== "panelist" || pan.banned) return { error: "Choose an active panelist." };

  let interviewId: string;
  try {
    const [created] = await db
      .insert(interviews)
      .values({
        candidateId,
        jobId,
        round,
        mode: "direct",
        panelistId,
        startsAt: slot.data.startsAt,
        endsAt: slot.data.endsAt,
        timeZone: slot.data.timeZone,
        status: "pending",
        createdBy: actor.id,
      })
      .returning({ id: interviews.id });
    interviewId = created.id;
  } catch (err) {
    if (isOverlap(err)) return { error: OVERLAP_MSG };
    if (isUniqueViolation(err)) return { error: "This candidate already has a live interview for this round." };
    console.error(err);
    return { error: "Could not book the interview. Try again." };
  }

  const d: Details = {
    candidateName: cand.name,
    jobTitle: job.title,
    round,
    startsAt: slot.data.startsAt,
    timeZone: slot.data.timeZone,
  };
  const mail = panelistRequestMail(pan.name, d);
  await notifyUser({
    userId: pan.id,
    email: pan.email,
    subject: mail.subject,
    html: mail.html,
    title: "New interview request",
    body: `${cand.name} - ${job.title}, round ${round}`,
    link: "/panelist/interviews",
  });
  await logActivity({
    actorId: actor.id,
    action: "interview.requested",
    entityType: "interview",
    entityId: interviewId,
    details: { candidateId, panelistId, round },
  });

  revalidatePath(`/jobs/${jobId}/candidates/${candidateId}/interviews`);
  return { ok: `Request sent to ${pan.name}. The interview is confirmed when they accept.` };
}

export async function rescheduleInterviewAction(
  _prev: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const { user: actor } = await requireAnyRole(ROLES);
  const raw = Object.fromEntries(formData);
  const id = z.string().uuid().safeParse(raw.interviewId);
  if (!id.success) return { error: "Invalid interview." };
  const slot = futureSlot().safeParse(raw);
  if (!slot.success) return { error: slot.error.issues[0].message };

  const ctx = await loadInterview(id.data);
  if (!ctx) return { error: "That interview no longer exists." };
  const { interview } = ctx;
  if (interview.status !== "pending" && interview.status !== "scheduled") {
    return { error: `A ${INTERVIEW_STATUS_LABEL[interview.status].toLowerCase()} interview cannot be rescheduled.` };
  }
  if (interview.status === "scheduled" && interview.bookingState !== "confirmed") {
    return { error: "Recover the Teams invite before rescheduling this interview." };
  }
  if (interview.calendarState !== "idle") return { error: "Another calendar change is already in progress." };

  let reservedVersion: number;
  try {
    const [reserved] = await db
      .update(interviews)
      .set({
        startsAt: slot.data.startsAt,
        endsAt: slot.data.endsAt,
        timeZone: slot.data.timeZone,
        calendarState: interview.status === "scheduled" ? "rescheduling" : "idle",
        version: sql`${interviews.version} + 1`,
        scheduleRevision: sql`${interviews.scheduleRevision} + 1`,
        reminder24SentAt: null,
        reminder1SentAt: null,
      })
      .where(and(eq(interviews.id, interview.id), eq(interviews.status, interview.status), eq(interviews.calendarState, "idle"), eq(interviews.version, interview.version)))
      .returning({ version: interviews.version });
    if (!reserved) return { error: "This interview changed while you were editing it. Refresh and try again." };
    reservedVersion = reserved.version;
    await db.update(interviewDeliveries).set({ state: "cancelled" }).where(and(
      eq(interviewDeliveries.interviewId, interview.id),
      inArray(interviewDeliveries.state, ["pending", "failed"]),
    ));
  } catch (err) {
    if (isOverlap(err)) return { error: OVERLAP_MSG };
    console.error(err);
    return { error: "Could not reschedule. Try again." };
  }

  if (interview.status === "scheduled" && interview.graphEventId) {
    try {
      await rescheduleInterviewEvent(interview.graphEventId, slot.data.startsAt, slot.data.endsAt);
    } catch (err) {
      console.error(err);
      // Put the old time back so the platform and the calendar agree.
      await db
        .update(interviews)
        .set({ startsAt: interview.startsAt, endsAt: interview.endsAt, timeZone: interview.timeZone, calendarState: "idle", version: sql`${interviews.version} + 1` })
        .where(and(eq(interviews.id, interview.id), eq(interviews.calendarState, "rescheduling"), eq(interviews.version, reservedVersion)));
      return { error: "The Teams invite could not be updated, so nothing changed. Try again." };
    }
    const [finished] = await db
      .update(interviews)
      .set({ calendarState: "idle", version: sql`${interviews.version} + 1` })
      .where(and(eq(interviews.id, interview.id), eq(interviews.calendarState, "rescheduling"), eq(interviews.version, reservedVersion)))
      .returning({ id: interviews.id });
    if (!finished) return { error: "The calendar was updated, but the local record changed. Refresh before making another change." };
  }

  if (ctx.panelist) {
    const d = { ...details(ctx), startsAt: slot.data.startsAt, timeZone: slot.data.timeZone };
    const mail = panelistRescheduledMail(ctx.panelist.name, d);
    await notifyUser({
      userId: ctx.panelist.id,
      email: ctx.panelist.email,
      subject: mail.subject,
      html: mail.html,
      title: "Interview rescheduled",
      body: `${ctx.candidate.name} - ${ctx.job.title}, round ${interview.round}`,
      link: "/panelist/interviews",
    });
  }
  await logActivity({
    actorId: actor.id,
    action: "interview.rescheduled",
    entityType: "interview",
    entityId: interview.id,
    details: { from: interview.startsAt.toISOString(), to: slot.data.startsAt.toISOString() },
  });

  revalidatePath(`/jobs/${interview.jobId}/candidates/${interview.candidateId}/interviews`);
  return { ok: "Rescheduled. Everyone has been notified." };
}

export async function cancelInterviewAction(
  _prev: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const { user: actor } = await requireAnyRole(ROLES);
  const id = z.string().uuid().safeParse(formData.get("interviewId"));
  if (!id.success) return { error: "Invalid interview." };

  const ctx = await loadInterview(id.data);
  if (!ctx) return { error: "That interview no longer exists." };
  const { interview } = ctx;
  if (interview.status !== "pending" && interview.status !== "scheduled") {
    return { error: "This interview is already closed." };
  }
  if (interview.status === "scheduled" && interview.bookingState === "creating") {
    return { error: "The Teams invite is still being created. Wait a moment, then try again." };
  }
  if (interview.status === "scheduled" && interview.bookingState === "failed" && !interview.graphEventId) {
    return { error: "Recover the Teams invite before cancelling this interview." };
  }
  if (interview.calendarState !== "idle") return { error: "Another calendar change is already in progress." };

  const [reserved] = await db
    .update(interviews)
    .set(interview.status === "scheduled"
      ? { calendarState: "cancelling", version: sql`${interviews.version} + 1` }
      : { status: "cancelled", version: sql`${interviews.version} + 1` })
    .where(and(eq(interviews.id, interview.id), eq(interviews.status, interview.status), eq(interviews.calendarState, "idle"), eq(interviews.version, interview.version)))
    .returning({ version: interviews.version });
  if (!reserved) return { error: "This interview changed before it could be cancelled. Refresh and try again." };

  if (interview.status === "scheduled" && interview.graphEventId) {
    try {
      await cancelInterviewEvent(interview.graphEventId, "This interview was cancelled by the recruiter.");
    } catch (err) {
      console.error(err);
      await db.update(interviews)
        .set({ calendarState: "idle", version: sql`${interviews.version} + 1` })
        .where(and(eq(interviews.id, interview.id), eq(interviews.calendarState, "cancelling"), eq(interviews.version, reserved.version)));
      return { error: "The Teams invite could not be cancelled, so nothing changed. Try again." };
    }
  }

  if (interview.status === "scheduled") {
    const [cancelled] = await db.update(interviews)
      .set({ status: "cancelled", calendarState: "idle", version: sql`${interviews.version} + 1` })
      .where(and(eq(interviews.id, interview.id), eq(interviews.status, "scheduled"), eq(interviews.calendarState, "cancelling"), eq(interviews.version, reserved.version)))
      .returning({ id: interviews.id });
    if (!cancelled) return { error: "The calendar invite was cancelled, but the local record changed. Refresh the page." };
  }
  if (ctx.candidate.stage === "interview_scheduled") {
    const done = await completedRounds(interview.candidateId);
    await db
      .update(candidates)
      .set({ stage: done === 0 ? "uploaded" : "next_round" })
      .where(eq(candidates.id, interview.candidateId));
  }

  if (ctx.panelist) {
    const mail = panelistCancelledMail(ctx.panelist.name, details(ctx));
    await notifyUser({
      userId: ctx.panelist.id,
      email: ctx.panelist.email,
      subject: mail.subject,
      html: mail.html,
      title: "Interview cancelled",
      body: `${ctx.candidate.name} - ${ctx.job.title}, round ${interview.round}`,
      link: "/panelist/interviews",
    });
  }
  await logActivity({
    actorId: actor.id,
    action: "interview.cancelled",
    entityType: "interview",
    entityId: interview.id,
  });

  revalidatePath(`/jobs/${interview.jobId}/candidates/${interview.candidateId}/interviews`);
  return { ok: "Interview cancelled." };
}

export async function decideOutcomeAction(
  _prev: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const { user: actor } = await requireAnyRole(ROLES);
  const parsed = z
    .object({
      candidateId: z.string().uuid(),
      jobId: z.string().uuid(),
      outcome: z.enum(["next_round", "selected", "rejected"], { message: "Choose a decision" }),
      emailCandidate: z.string().optional(),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { candidateId, jobId, outcome } = parsed.data;
  const emailCandidate = parsed.data.emailCandidate === "on";

  const [cand] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId)));
  if (!cand) return { error: "That candidate no longer exists." };
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));

  // Feedback for the most recent finished round must exist before a decision.
  const done = await completedRounds(candidateId);
  const [latest] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .innerJoin(feedback, eq(feedback.interviewId, interviews.id))
    .where(and(eq(interviews.candidateId, candidateId), eq(interviews.round, done), eq(interviews.status, "completed")));

  const allowed = allowedOutcomes({
    stage: cand.stage,
    completedRounds: done,
    totalRounds: job.rounds,
    hasFeedback: Boolean(latest),
  });
  if (!allowed.includes(outcome)) {
    return { error: "That decision is not available for this candidate right now." };
  }

  // Only one decision can win: the update applies only while the candidate is still at "Interview done".
  const [moved] = await db
    .update(candidates)
    .set({ stage: OUTCOME_STAGE[outcome] })
    .where(and(eq(candidates.id, candidateId), eq(candidates.stage, "interview_done")))
    .returning({ id: candidates.id });
  if (!moved) return { error: "A decision has already been saved for this candidate." };

  let emailed = false;
  let emailFailed = false;
  if (emailCandidate) {
    try {
      const mail = outcomeMail(cand.name, job.title, outcome);
      await sendMail({ to: cand.email, subject: mail.subject, html: mail.html });
      emailed = true;
    } catch (err) {
      console.error("Outcome email failed:", err);
      emailFailed = true;
    }
  }
  await logActivity({
    actorId: actor.id,
    action: "candidate.stage_changed",
    entityType: "candidate",
    entityId: candidateId,
    details: { from: "interview_done", to: OUTCOME_STAGE[outcome], emailed },
  });

  if (outcome === "next_round") {
    await announceWaitingCandidate(cand.name, job.title, done + 1);
  }

  revalidatePath(`/jobs/${jobId}/candidates/${candidateId}/interviews`);
  revalidatePath(`/jobs/${jobId}/candidates`);
  return {
    ok:
      `Saved: ${OUTCOME_LABEL[outcome]}.` +
      (emailed ? " The candidate has been emailed." : "") +
      (emailFailed ? " The decision is saved, but the email to the candidate could not be sent." : ""),
  };
}

/** The recruiter opens a slot with a set date and time; every panelist is told and the first to pick it takes it. */
export async function postToPipelineAction(
  _prev: InterviewFormState,
  formData: FormData,
): Promise<InterviewFormState> {
  const { user: actor } = await requireAnyRole(ROLES);
  const raw = Object.fromEntries(formData);
  const ids = scheduleSchema.omit({ panelistId: true, round: true }).safeParse(raw);
  if (!ids.success) return { error: ids.error.issues[0].message };
  const slot = futureSlot().safeParse(raw);
  if (!slot.success) return { error: slot.error.issues[0].message };
  const { candidateId, jobId } = ids.data;

  const [cand] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, candidateId), eq(candidates.jobId, jobId)));
  if (!cand) return { error: "That candidate no longer exists." };
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));

  const [live] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(interviews)
    .where(and(eq(interviews.candidateId, candidateId), sql`${interviews.status} in ('pending', 'scheduled')`));
  const eligible = pipelineEligibility({
    stage: cand.stage,
    jobStatus: job.status,
    hasLiveInterview: (live?.n ?? 0) > 0,
    completedRounds: await completedRounds(candidateId),
    totalRounds: job.rounds,
  });
  if (!eligible.ok) return { error: eligible.reason };

  let interviewId: string;
  try {
    const [created] = await db
      .insert(interviews)
      .values({
        candidateId,
        jobId,
        round: eligible.round,
        mode: "pipeline",
        panelistId: null,
        startsAt: slot.data.startsAt,
        endsAt: slot.data.endsAt,
        timeZone: slot.data.timeZone,
        status: "pending",
        createdBy: actor.id,
      })
      .returning({ id: interviews.id });
    interviewId = created.id;
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "This candidate already has a live interview for this round." };
    console.error(err);
    return { error: "Could not post to the pipeline. Try again." };
  }

  const d: Details = {
    candidateName: cand.name,
    jobTitle: job.title,
    round: eligible.round,
    startsAt: slot.data.startsAt,
    timeZone: slot.data.timeZone,
  };
  const count = await notifyAllPanelists({
    title: "Interview slot open",
    body: `${cand.name} - ${job.title}, round ${eligible.round}`,
    link: "/panelist/pipeline",
    mailFor: (name) => openSlotMail(name, d),
  });
  await logActivity({
    actorId: actor.id,
    action: "interview.posted",
    entityType: "interview",
    entityId: interviewId,
    details: { candidateId, round: eligible.round, panelistsNotified: count },
  });

  revalidatePath(`/jobs/${jobId}/candidates/${candidateId}/interviews`);
  return { ok: `Posted to the pipeline. ${count} panelist${count === 1 ? "" : "s"} notified; the first to pick it takes it.` };
}

