import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requireAnyRole } from "@/lib/dal";
import { createCandidateAction } from "../actions";
import { CandidateForm } from "../CandidateForm";

export default async function NewCandidatePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["admin", "recruiter"]);
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id.data));
  if (!job) notFound();
  if (job.status !== "open") redirect(`/jobs/${job.id}/candidates`);

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Add candidate to {job.title}</h1>
      <CandidateForm action={createCandidateAction} jobId={job.id} submitLabel="Add candidate" />
    </section>
  );
}
