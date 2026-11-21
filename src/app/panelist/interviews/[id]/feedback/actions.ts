"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { feedback, interviews } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { feedbackSubmittedMail, type Details } from "@/lib/emails";
import { isUniqueViolation, loadInterview } from "@/lib/interviews";
import { notifyUser } from "@/lib/notify";
import { requireRole } from "@/lib/dal";
import { feedbackSchema } from "@/lib/validation/feedback";

export type FeedbackFormState = { error?: string };

export async function submitFeedbackAction(
  _prev: FeedbackFormState,
  formData: FormData,
): Promise<FeedbackFormState> {
  const { user: me } = await requireRole("panelist");
  const parsed = feedbackSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { interviewId, rating, recommendation, comments } = parsed.data;

  // Only the panelist who held a finished interview can give feedback on it.
  const [mine] = await db
    .select({ id: interviews.id })
    .from(interviews)
    .where(and(eq(interviews.id, interviewId), eq(interviews.panelistId, me.id), eq(interviews.status, "completed")));
  if (!mine) return { error: "You cannot give feedback on this interview." };

  try {
    await db.insert(feedback).values({ interviewId, panelistId: me.id, rating, recommendation, comments });
  } catch (err) {
    if (isUniqueViolation(err)) return { error: "Feedback has already been submitted for this interview." };
    console.error(err);
    return { error: "Could not save your feedback. Try again." };
  }

  const ctx = await loadInterview(interviewId);
  if (ctx) {
    const d: Details = {
      candidateName: ctx.candidate.name,
      jobTitle: ctx.job.title,
      round: ctx.interview.round,
      startsAt: ctx.interview.startsAt,
      timeZone: ctx.interview.timeZone,
    };
    const link = `/jobs/${ctx.job.id}/candidates/${ctx.candidate.id}/interviews`;
    const mail = feedbackSubmittedMail(ctx.recruiter.name, me.name, rating, recommendation, d, link);
    await notifyUser({
      userId: ctx.recruiter.id,
      email: ctx.recruiter.email,
      subject: mail.subject,
      html: mail.html,
      title: "Feedback received",
      body: `${ctx.candidate.name} - ${ctx.job.title}, round ${ctx.interview.round}`,
      link,
    });
  }
  await logActivity({
    actorId: me.id,
    action: "feedback.submitted",
    entityType: "interview",
    entityId: interviewId,
    details: { rating, recommendation },
  });

  revalidatePath("/panelist/interviews");
  redirect("/panelist/interviews");
}
