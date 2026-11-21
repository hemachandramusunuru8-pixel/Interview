import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, interviews, jobs, user } from "@/db/schema";

const userFields = { id: user.id, name: user.name, email: user.email, role: user.role, banned: user.banned };

/** One interview with everything needed to email, invite and display it. */
export async function loadInterview(interviewId: string) {
  const [interview] = await db.select().from(interviews).where(eq(interviews.id, interviewId));
  if (!interview) return null;

  const [[candidate], [job], panelistRows, [recruiter]] = await Promise.all([
    db
      .select({
        id: candidates.id,
        name: candidates.name,
        email: candidates.email,
        stage: candidates.stage,
        experienceYears: candidates.experienceYears,
        skills: candidates.skills,
      })
      .from(candidates)
      .where(eq(candidates.id, interview.candidateId)),
    db
      .select({ id: jobs.id, title: jobs.title, rounds: jobs.rounds, status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, interview.jobId)),
    interview.panelistId
      ? db.select(userFields).from(user).where(eq(user.id, interview.panelistId))
      : Promise.resolve([]),
    db.select(userFields).from(user).where(eq(user.id, interview.createdBy)),
  ]);

  return { interview, candidate, job, panelist: panelistRows[0] ?? null, recruiter };
}

export type InterviewContext = NonNullable<Awaited<ReturnType<typeof loadInterview>>>;

/** How many rounds this candidate has finished; the next round to book is this plus one. */
export async function completedRounds(candidateId: string): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(interviews)
    .where(and(eq(interviews.candidateId, candidateId), eq(interviews.status, "completed")));
  return r?.n ?? 0;
}

/** True for Postgres "exclusion constraint violation": the panelist already has an interview at that time. */
export function isOverlap(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23P01" || e?.cause?.code === "23P01";
}

export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}
