import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { StageBadge } from "@/components/status";
import { ButtonLink, PageHeader } from "@/components/ui";
import { requireAnyRole } from "@/lib/dal";
import { updateCandidateAction } from "../actions";
import { CandidateForm } from "../CandidateForm";

export const metadata = { title: "Edit candidate" };

export default async function EditCandidatePage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  await requireAnyRole(["admin", "recruiter"]);
  const p = await params;
  const ids = z.object({ id: z.string().uuid(), candidateId: z.string().uuid() }).safeParse(p);
  if (!ids.success) notFound();

  const [c] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, ids.data.candidateId), eq(candidates.jobId, ids.data.id)));
  if (!c) notFound();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={<span className="flex flex-wrap items-center gap-3">{c.name} <StageBadge stage={c.stage} /></span>}
        description="Update contact details, background or the resume."
        back={{ href: `/jobs/${ids.data.id}/candidates`, label: "Candidates" }}
        actions={<ButtonLink href={`/jobs/${ids.data.id}/candidates/${c.id}/interviews`} variant="secondary">Interviews</ButtonLink>}
      />
      <CandidateForm action={updateCandidateAction} jobId={ids.data.id} submitLabel="Save changes" candidate={c} />
    </div>
  );
}
