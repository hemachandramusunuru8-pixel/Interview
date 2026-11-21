import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { jobs } from "@/db/schema";
import { JobStatusBadge } from "@/components/status";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireAnyRole } from "@/lib/dal";
import { updateJobAction } from "../actions";
import { JobForm } from "../JobForm";

export const metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["admin", "recruiter"]);
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id.data));
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={<span className="flex items-center gap-3">Edit job <JobStatusBadge status={job.status} /></span>}
        description={job.title}
        back={{ href: "/jobs", label: "Jobs" }}
        actions={<ButtonLink href={`/jobs/${job.id}/candidates`} variant="secondary">View candidates</ButtonLink>}
      />
      <JobForm action={updateJobAction} submitLabel="Save changes" job={job} />
    </div>
  );
}
