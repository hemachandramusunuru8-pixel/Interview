import "server-only";
import { and, asc, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityLog, candidates, feedback, interviews, jobs, user } from "@/db/schema";


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

// Each dashboard's numbers come from ONE query (scalar subqueries) instead of one query per number:
// every round trip to the database costs ~100-200 ms, so this is what makes dashboards fast.
type Row = Record<string, number>;
async function counts(query: ReturnType<typeof sql>): Promise<Row> {
  const result = await db.execute<Row>(query);
  return result.rows[0] ?? {};
}

export async function adminDashboard() {
  const [c, recent, next] = await Promise.all([
    counts(sql`
      select
        (select count(*)::int from "user" where coalesce(banned, false) = false and role = 'admin') as admins,
        (select count(*)::int from "user" where coalesce(banned, false) = false and role = 'recruiter') as recruiters,
        (select count(*)::int from "user" where coalesce(banned, false) = false and role = 'panelist') as panelists,
        (select count(*)::int from jobs where status = 'open') as open_jobs,
        (select count(*)::int from candidates) as candidates,
        (select count(*)::int from interviews where status = 'scheduled' and ends_at > now()) as upcoming,
        (select count(*)::int from interviews where status = 'pending') as pending`),
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
  return {
    users: { admin: c.admins ?? 0, recruiter: c.recruiters ?? 0, panelist: c.panelists ?? 0 },
    openJobs: c.open_jobs ?? 0,
    candidates: c.candidates ?? 0,
    upcoming: c.upcoming ?? 0,
    pending: c.pending ?? 0,
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
  const [c, decisions, next, recentCandidates] = await Promise.all([
    counts(sql`
      select
        (select count(*)::int from jobs where status = 'open') as open_jobs,
        (select count(*)::int from candidates c join jobs j on j.id = c.job_id
           where j.status = 'open' and c.stage in ('uploaded', 'next_round')) as waiting,
        (select count(*)::int from interviews where status = 'scheduled' and ends_at > now()) as upcoming`),
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
    openJobs: c.open_jobs ?? 0,
    waiting: c.waiting ?? 0,
    upcoming: c.upcoming ?? 0,
    decisionsCount: decisions.length,
    decisions,
    next,
    recentCandidates,
  };
}

export async function panelistDashboard(panelistId: string) {
  const [c, next, requestList] = await Promise.all([
    counts(sql`
      select
        (select count(*)::int from interviews
           where panelist_id = ${panelistId} and status = 'pending' and starts_at > now()) as requests,
        (select count(*)::int from interviews i left join feedback f on f.interview_id = i.id
           where i.panelist_id = ${panelistId} and i.status = 'completed' and f.id is null) as feedback_due,
        (select count(*)::int from interviews
           where mode = 'pipeline' and status = 'pending' and panelist_id is null and starts_at > now()) as open_slots,
        (select count(*)::int from candidates c join jobs j on j.id = c.job_id
           where j.status = 'open' and c.stage in ('uploaded', 'next_round')
             and not exists (select 1 from interviews i
                             where i.candidate_id = c.id and i.status in ('pending', 'scheduled'))) as waiting`),
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
    requests: c.requests ?? 0,
    feedbackDue: c.feedback_due ?? 0,
    pipeline: (c.open_slots ?? 0) + (c.waiting ?? 0),
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
