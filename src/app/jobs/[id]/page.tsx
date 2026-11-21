import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requireAnyRole } from "@/lib/dal";
import { updateJobAction } from "../actions";
import { JobForm } from "../JobForm";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["admin", "recruiter"]);
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id.data));
  if (!job) notFound();

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Edit job</h1>
      <JobForm action={updateJobAction} submitLabel="Save changes" job={job} />
    </section>
  );
}
