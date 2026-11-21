"use server";

import { and, eq, gt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { confirmBooking } from "@/lib/booking";
import { requireRole } from "@/lib/dal";
import { recruiterDeclinedMail, type Details } from "@/lib/emails";
import { loadInterview } from "@/lib/interviews";
import { notifyUser } from "@/lib/notify";
import { declineSchema } from "@/lib/validation/interview";

export type PanelistActionState = { error?: string; ok?: string };

export async function acceptInterviewAction(
  _prev: PanelistActionState,
  formData: FormData,
): Promise<PanelistActionState> {
  const { user: me } = await requireRole("panelist");
  const id = z.string().uuid().safeParse(formData.get("interviewId"));
  if (!id.success) return { error: "Invalid interview." };

  // Claim the request in one atomic step: only a pending request addressed to me, still in the future.
  // A second click, or a recruiter cancelling at the same moment, cannot be accepted twice.
  const [claimed] = await db
    .update(interviews)
    .set({ status: "scheduled" })
    .where(
      and(
        eq(interviews.id, id.data),
        eq(interviews.panelistId, me.id),
        eq(interviews.status, "pending"),
        gt(interviews.startsAt, new Date()),
      ),
    )
    .returning({ id: interviews.id });
  if (!claimed) return { error: "This request is no longer available to accept." };

  const result = await confirmBooking(id.data, me.id, "interview.accepted");
  if (!result.ok) {
    // Nothing was sent to anyone: put the request back so it can be accepted again.
    await db.update(interviews).set({ status: "pending" }).where(eq(interviews.id, id.data));
    return { error: result.error };
  }

  revalidatePath("/panelist/interviews");
  return { ok: "Accepted. The Teams invite has been sent to everyone." };
}

export async function declineInterviewAction(
  _prev: PanelistActionState,
  formData: FormData,
): Promise<PanelistActionState> {
  const { user: me } = await requireRole("panelist");
  const parsed = declineSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { interviewId, reason } = parsed.data;

  const [declined] = await db
    .update(interviews)
    .set({ status: "declined", declineReason: reason || null })
    .where(and(eq(interviews.id, interviewId), eq(interviews.panelistId, me.id), eq(interviews.status, "pending")))
    .returning({ id: interviews.id });
  if (!declined) return { error: "This request is no longer available to decline." };

  const ctx = await loadInterview(interviewId);
  if (ctx?.panelist) {
    const d: Details = {
      candidateName: ctx.candidate.name,
      jobTitle: ctx.job.title,
      round: ctx.interview.round,
      startsAt: ctx.interview.startsAt,
      timeZone: ctx.interview.timeZone,
    };
    const mail = recruiterDeclinedMail(ctx.recruiter.name, ctx.panelist.name, reason, d);
    await notifyUser({
      userId: ctx.recruiter.id,
      email: ctx.recruiter.email,
      subject: mail.subject,
      html: mail.html,
      title: "Interview declined",
      body: `${ctx.panelist.name} declined ${ctx.candidate.name} (${ctx.job.title}, round ${ctx.interview.round})`,
      link: `/jobs/${ctx.job.id}/candidates/${ctx.candidate.id}/interviews`,
    });
  }
  await logActivity({
    actorId: me.id,
    action: "interview.declined",
    entityType: "interview",
    entityId: interviewId,
    details: { reason: reason || null },
  });

  revalidatePath("/panelist/interviews");
  return { ok: "Declined. The recruiter has been told. The recruiter can send it to another panelist or post it to the pipeline." };
}
