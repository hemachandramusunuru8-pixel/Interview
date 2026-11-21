"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireAnyRole } from "@/lib/dal";
import { jobSchema } from "@/lib/validation/job";

export type JobFormState = { error?: string };

const JOB_ROLES = ["admin", "recruiter"] as const;

export async function createJobAction(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const { user } = await requireAnyRole(JOB_ROLES);
  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [created] = await db
    .insert(jobs)
    .values({ ...parsed.data, createdBy: user.id })
    .returning({ id: jobs.id });
  await logActivity({
    actorId: user.id,
    action: "job.created",
    entityType: "job",
    entityId: created.id,
    details: { title: parsed.data.title, status: parsed.data.status },
  });
  revalidatePath("/jobs");
  redirect("/jobs");
}

export async function updateJobAction(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  const { user } = await requireAnyRole(JOB_ROLES);
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { error: "Invalid job." };
  const parsed = jobSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [before] = await db.select().from(jobs).where(eq(jobs.id, id.data));
  if (!before) return { error: "That job no longer exists." };

  await db.update(jobs).set(parsed.data).where(eq(jobs.id, id.data));

  const changed = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
    (k) => JSON.stringify(parsed.data[k]) !== JSON.stringify(before[k]),
  );
  if (changed.length > 0) {
    await logActivity({
      actorId: user.id,
      action: "job.updated",
      entityType: "job",
      entityId: id.data,
      details: { changed },
    });
  }
  if (before.status !== parsed.data.status) {
    await logActivity({
      actorId: user.id,
      action: "job.status_changed",
      entityType: "job",
      entityId: id.data,
      details: { from: before.status, to: parsed.data.status },
    });
  }
  revalidatePath("/jobs");
  redirect("/jobs");
}
