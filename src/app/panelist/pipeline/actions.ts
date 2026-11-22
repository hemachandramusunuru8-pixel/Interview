"use server";

import { and, eq, exists, gt, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, interviews, jobs } from "@/db/schema";
import { confirmBooking } from "@/lib/booking";
import { requireRole } from "@/lib/dal";
import { completedRounds, isOverlap, isUniqueViolation } from "@/lib/interviews";
import { pipelineEligibility } from "@/lib/pipeline";
import { futureSlot } from "@/lib/validation/interview";

export type PipelineState = { error?: string; ok?: string };

const BUSY = "You already have an interview at that time. Choose another time.";
const TAKEN = "Someone else just took this interview. It is no longer available.";

/** Pick a slot the recruiter opened. The first panelist to click wins; the claim is one atomic UPDATE. */
export async function pickSlotAction(_prev: PipelineState, formData: FormData): Promise<PipelineState> {
  const { user: me } = await requireRole("panelist");
  const id = z.string().uuid().safeParse(formData.get("interviewId"));
  if (!id.success) return { error: "Invalid interview." };

  let claimed: { id: string } | undefined;
  try {
    [claimed] = await db
      .update(interviews)
      .set({ panelistId: me.id, status: "scheduled", bookingState: "creating", version: sql`${interviews.version} + 1` })
      .where(
        and(
          eq(interviews.id, id.data),
          eq(interviews.mode, "pipeline"),
          eq(interviews.status, "pending"),
          eq(interviews.calendarState, "idle"),
          isNull(interviews.panelistId),
          gt(interviews.startsAt, new Date()),
          exists(db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, interviews.jobId), eq(jobs.status, "open")))),
        ),
      )
      .returning({ id: interviews.id });
  } catch (err) {
    if (isOverlap(err)) return { error: BUSY };
    console.error(err);
    return { error: "Could not pick this interview. Try again." };
  }
  if (!claimed) return { error: TAKEN };

  const result = await confirmBooking(id.data, me.id, "interview.picked");
  if (!result.ok) {
    revalidatePath("/panelist/pipeline");
    revalidatePath("/panelist/interviews");
    return { error: result.error };
  }
  revalidatePath("/panelist/pipeline");
  revalidatePath("/panelist/interviews");
  return { ok: "You picked this interview. The Teams invite has been sent to everyone." };
}

/** Pick a candidate who is waiting and choose the time yourself. */
export async function pickCandidateAction(_prev: PipelineState, formData: FormData): Promise<PipelineState> {
  const { user: me } = await requireRole("panelist");
  const raw = Object.fromEntries(formData);
  const candidateId = z.string().uuid().safeParse(raw.candidateId);
  if (!candidateId.success) return { error: "Invalid candidate." };
  const slot = futureSlot().safeParse(raw);
  if (!slot.success) return { error: slot.error.issues[0].message };

  const [row] = await db
    .select({ cand: candidates, job: jobs })
    .from(candidates)
    .innerJoin(jobs, eq(candidates.jobId, jobs.id))
    .where(eq(candidates.id, candidateId.data));
  if (!row) return { error: "That candidate no longer exists." };

  const [live] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(interviews)
    .where(
      and(
        eq(interviews.candidateId, row.cand.id),
        sql`${interviews.status} in ('pending', 'scheduled')`,
      ),
    );
  const eligible = pipelineEligibility({
    stage: row.cand.stage,
    jobStatus: row.job.status,
    hasLiveInterview: (live?.n ?? 0) > 0,
    completedRounds: await completedRounds(row.cand.id),
    totalRounds: row.job.rounds,
  });
  if (!eligible.ok) return { error: eligible.reason };

  let interviewId: string;
  try {
    const [created] = await db
      .insert(interviews)
      .values({
        candidateId: row.cand.id,
        jobId: row.job.id,
        round: eligible.round,
        mode: "pipeline",
        panelistId: me.id,
        startsAt: slot.data.startsAt,
        endsAt: slot.data.endsAt,
        timeZone: slot.data.timeZone,
        status: "scheduled",
        bookingState: "creating",
        // The recruiter who added the candidate is the one told and invited.
        createdBy: row.cand.createdBy,
      })
      .returning({ id: interviews.id });
    interviewId = created.id;
  } catch (err) {
    // The database allows only one live interview per candidate and round, so two panelists
    // clicking at once can never both win.
    if (isUniqueViolation(err)) return { error: TAKEN };
    if (isOverlap(err)) return { error: BUSY };
    console.error(err);
    return { error: "Could not book this interview. Try again." };
  }

  const result = await confirmBooking(interviewId, me.id, "interview.picked");
  if (!result.ok) {
    revalidatePath("/panelist/pipeline");
    revalidatePath("/panelist/interviews");
    return { error: result.error };
  }
  revalidatePath("/panelist/pipeline");
  revalidatePath("/panelist/interviews");
  return { ok: "You picked this candidate. The Teams invite has been sent to everyone." };
}
