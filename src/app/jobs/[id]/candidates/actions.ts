"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { candidates, jobs } from "@/db/schema";
import { logActivity } from "@/lib/activity";
import { requireAnyRole } from "@/lib/dal";
import { announceWaitingCandidate } from "@/lib/notify";
import { deleteResume, uploadResume } from "@/lib/storage";
import { candidateSchema } from "@/lib/validation/candidate";
import { checkResume } from "@/lib/validation/resume";

export type CandidateFormState = { error?: string };

const ROLES = ["admin", "recruiter"] as const;
const uuid = z.string().uuid();

function isDuplicateEmail(err: unknown) {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
}

/** Reads and checks the uploaded resume. Returns null when no file was chosen. */
async function readResume(formData: FormData) {
  const file = formData.get("resume");
  if (!(file instanceof File) || file.size === 0) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkResume(file.name, file.size, bytes);
  if (!check.ok) return { error: check.error } as const;
  return { name: file.name.slice(0, 200), bytes, ext: check.ext, contentType: check.contentType } as const;
}

export async function createCandidateAction(
  _prev: CandidateFormState,
  formData: FormData,
): Promise<CandidateFormState> {
  const { user } = await requireAnyRole(ROLES);

  const jobId = uuid.safeParse(formData.get("jobId"));
  if (!jobId.success) return { error: "Invalid job." };
  const [job] = await db.select({ id: jobs.id, title: jobs.title, status: jobs.status }).from(jobs).where(eq(jobs.id, jobId.data));
  if (!job) return { error: "That job no longer exists." };
  if (job.status !== "open") return { error: "Candidates can only be added to an open job." };

  const parsed = candidateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const resume = await readResume(formData);
  if (!resume) return { error: "Upload the candidate's resume (PDF, DOC or DOCX)." };
  if ("error" in resume) return { error: resume.error };

  let path: string;
  try {
    path = await uploadResume(job.id, resume);
  } catch (err) {
    console.error(err);
    return { error: "The resume could not be uploaded. Try again." };
  }

  try {
    await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(candidates)
        .values({ ...parsed.data, jobId: job.id, resumePath: path, resumeFilename: resume.name, createdBy: user.id })
        .returning({ id: candidates.id });
      await logActivity(
        {
          actorId: user.id,
          action: "candidate.created",
          entityType: "candidate",
          entityId: created.id,
          details: { jobId: job.id, email: parsed.data.email },
        },
        tx,
      );
    });
  } catch (err) {
    // Postgres rolled back both the candidate and its audit entry, so this object is unreferenced.
    await deleteResume(path);
    if (isDuplicateEmail(err)) return { error: "A candidate with this email is already on this job." };
    console.error(err);
    return { error: "Could not save the candidate. Try again." };
  }

  // A new candidate goes straight into the pipeline: every panelist is told they are waiting.
  await announceWaitingCandidate(parsed.data.name, job.title, 1);

  revalidatePath(`/jobs/${job.id}/candidates`);
  redirect(`/jobs/${job.id}/candidates`);
}

export async function updateCandidateAction(
  _prev: CandidateFormState,
  formData: FormData,
): Promise<CandidateFormState> {
  const { user } = await requireAnyRole(ROLES);

  const id = uuid.safeParse(formData.get("id"));
  const jobId = uuid.safeParse(formData.get("jobId"));
  if (!id.success || !jobId.success) return { error: "Invalid candidate." };
  const parsed = candidateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const [before] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, id.data), eq(candidates.jobId, jobId.data)));
  if (!before) return { error: "That candidate no longer exists." };

  const resume = await readResume(formData);
  if (resume && "error" in resume) return { error: resume.error };

  let newPath: string | null = null;
  if (resume) {
    try {
      newPath = await uploadResume(jobId.data, resume);
    } catch (err) {
      console.error(err);
      return { error: "The resume could not be uploaded. Try again." };
    }
  }

  try {
    await db
      .update(candidates)
      .set({
        ...parsed.data,
        ...(resume && newPath ? { resumePath: newPath, resumeFilename: resume.name } : {}),
      })
      .where(eq(candidates.id, id.data));
  } catch (err) {
    if (newPath) await deleteResume(newPath);
    if (isDuplicateEmail(err)) return { error: "A candidate with this email is already on this job." };
    console.error(err);
    return { error: "Could not save the changes. Try again." };
  }

  const changed = (Object.keys(parsed.data) as (keyof typeof parsed.data)[]).filter(
    (k) => JSON.stringify(parsed.data[k]) !== JSON.stringify(before[k]),
  );
  if (changed.length > 0) {
    await logActivity({
      actorId: user.id,
      action: "candidate.updated",
      entityType: "candidate",
      entityId: id.data,
      details: { changed },
    });
  }
  if (newPath) {
    await deleteResume(before.resumePath); // old file is no longer referenced
    await logActivity({
      actorId: user.id,
      action: "candidate.resume_replaced",
      entityType: "candidate",
      entityId: id.data,
    });
  }

  revalidatePath(`/jobs/${jobId.data}/candidates`);
  redirect(`/jobs/${jobId.data}/candidates`);
}
