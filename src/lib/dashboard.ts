import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, candidates, feedback, interviews, jobs, user } from "@/db/schema";

const count = sql<number>`count(*)::int`;

/** Upcoming scheduled interviews, soonest first. Optionally only one panelist's. */
export async function upcomingInterviews(limit: number, panelistId?: string) {
  return db
    .select({
      id: interviews.id,
      startsAt: interviews.startsAt,
      timeZone: interviews.timeZone,
      round: interviews.round,
      teamsJoinUrl: interviews.teamsJoinUrl,
      candidateId: candidates.id,
      candidateName: candidates.name,
      jobId: jobs.id,
      jobTitle: jobs.title,
      panelistName: user.name,
    })
    .from(interviews)
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .innerJoin(jobs, eq(interviews.jobId, jobs.id))
    .leftJoin(user, eq(interviews.panelistId, user.id))
    .where(
      and(
        eq(interviews.status, "scheduled"),
        gt(interviews.endsAt, new Date()),
        panelistId ? eq(interviews.panelistId, panelistId) : undefined,
      ),
    )
    .orderBy(asc(interviews.startsAt))
    .limit(limit);
}

export async function adminDashboard() {
  const [roleCounts, [openJobs], [cands], [upcoming], [pending], recent, next] = await Promise.all([
    db
      .select({ role: user.role, n: count })
      .from(user)
      .where(eq(user.banned, false))
      .groupBy(user.role),
    db.select({ n: count }).from(jobs).where(eq(jobs.status, "open")),
    db.select({ n: count }).from(candidates),
    db
      .select({ n: count })
      .from(interviews)
      .where(and(eq(interviews.status, "scheduled"), gt(interviews.endsAt, new Date()))),
    db.select({ n: count }).from(interviews).where(eq(interviews.status, "pending")),
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        entityType: activityLog.entityType,
        createdAt: activityLog.createdAt,
        actorName: user.name,
      })
      .from(activityLog)
      .leftJoin(user, eq(activityLog.actorId, user.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(8),
    upcomingInterviews(5),
  ]);
  const roles = Object.fromEntries(roleCounts.map((r) => [r.role ?? "unknown", r.n]));
  return {
    users: { admin: roles.admin ?? 0, recruiter: roles.recruiter ?? 0, panelist: roles.panelist ?? 0 },
    openJobs: openJobs?.n ?? 0,
    candidates: cands?.n ?? 0,
    upcoming: upcoming?.n ?? 0,
    pending: pending?.n ?? 0,
    recent,
    next,
  };
}

/** Candidates whose latest interview is done and has feedback: the recruiter must decide. */
async function needsDecision(limit: number) {
  return db
    .select({
      candidateId: candidates.id,
      candidateName: candidates.name,
      jobId: jobs.id,
      jobTitle: jobs.title,
      round: interviews.round,
      rating: feedback.rating,
      recommendation: feedback.recommendation,
      submittedAt: feedback.submittedAt,
    })
    .from(candidates)
    .innerJoin(jobs, eq(candidates.jobId, jobs.id))
    .innerJoin(interviews, and(eq(interviews.candidateId, candidates.id), eq(interviews.status, "completed")))
    .innerJoin(feedback, eq(feedback.interviewId, interviews.id))
    .where(eq(candidates.stage, "interview_done"))
    .orderBy(desc(feedback.submittedAt))
    .limit(limit);
}

export async function recruiterDashboard() {
  const [[openJobs], [waiting], [upcoming], decisions, next, recentCandidates] = await Promise.all([
    db.select({ n: count }).from(jobs).where(eq(jobs.status, "open")),
    db
      .select({ n: count })
      .from(candidates)
      .innerJoin(jobs, eq(candidates.jobId, jobs.id))
      .where(and(eq(jobs.status, "open"), inArray(candidates.stage, ["uploaded", "next_round"]))),
    db
      .select({ n: count })
      .from(interviews)
      .where(and(eq(interviews.status, "scheduled"), gt(interviews.endsAt, new Date()))),
    needsDecision(6),
    upcomingInterviews(6),
    db
      .select({
        id: candidates.id,
        name: candidates.name,
        stage: candidates.stage,
        createdAt: candidates.createdAt,
        jobId: jobs.id,
        jobTitle: jobs.title,
      })
      .from(candidates)
      .innerJoin(jobs, eq(candidates.jobId, jobs.id))
      .orderBy(desc(candidates.createdAt))
      .limit(5),
  ]);
  return {
    openJobs: openJobs?.n ?? 0,
    waiting: waiting?.n ?? 0,
    upcoming: upcoming?.n ?? 0,
    decisionsCount: decisions.length,
    decisions,
    next,
    recentCandidates,
  };
}

export async function panelistDashboard(panelistId: string) {
  const [[requests], [feedbackDue], [openSlots], [waiting], next, requestList] = await Promise.all([
    db
      .select({ n: count })
      .from(interviews)
      .where(and(eq(interviews.panelistId, panelistId), eq(interviews.status, "pending"), gt(interviews.startsAt, new Date()))),
    db
      .select({ n: count })
      .from(interviews)
      .leftJoin(feedback, eq(feedback.interviewId, interviews.id))
      .where(and(eq(interviews.panelistId, panelistId), eq(interviews.status, "completed"), isNull(feedback.id))),
    db
      .select({ n: count })
      .from(interviews)
      .where(
        and(
          eq(interviews.mode, "pipeline"),
          eq(interviews.status, "pending"),
          isNull(interviews.panelistId),
          gt(interviews.startsAt, new Date()),
        ),
      ),
    db
      .select({ n: count })
      .from(candidates)
      .innerJoin(jobs, eq(candidates.jobId, jobs.id))
      .where(
        and(
          eq(jobs.status, "open"),
          inArray(candidates.stage, ["uploaded", "next_round"]),
          notExists(
            db
              .select({ x: sql`1` })
              .from(interviews)
              .where(and(eq(interviews.candidateId, candidates.id), inArray(interviews.status, ["pending", "scheduled"]))),
          ),
        ),
      ),
    upcomingInterviews(5, panelistId),
    db
      .select({
        id: interviews.id,
        startsAt: interviews.startsAt,
        timeZone: interviews.timeZone,
        round: interviews.round,
        candidateName: candidates.name,
        jobTitle: jobs.title,
      })
      .from(interviews)
      .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
      .innerJoin(jobs, eq(interviews.jobId, jobs.id))
      .where(and(eq(interviews.panelistId, panelistId), eq(interviews.status, "pending"), gt(interviews.startsAt, new Date())))
      .orderBy(asc(interviews.startsAt))
      .limit(5),
  ]);
  return {
    requests: requests?.n ?? 0,
    feedbackDue: feedbackDue?.n ?? 0,
    pipeline: (openSlots?.n ?? 0) + (waiting?.n ?? 0),
    upcoming: next.length,
    next,
    requestList,
  };
}

/** "user.created" -> "User created" */
export function describeAction(action: string): string {
  const [entity, verb] = action.split(".");
  const text = `${entity ?? ""} ${(verb ?? "").replace(/_/g, " ")}`.trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "5 min ago", "3 h ago", "2 d ago" */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.round((now.getTime() - date.getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
