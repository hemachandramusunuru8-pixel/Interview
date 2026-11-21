import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { candidates } from "@/db/schema";
import { requireAnyRole } from "@/lib/dal";
import { STAGE_LABEL } from "@/lib/validation/candidate";
import { updateCandidateAction } from "../actions";
import { CandidateForm } from "../CandidateForm";

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
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">
        {c.name} <span className="text-sm font-normal opacity-70">(Stage: {STAGE_LABEL[c.stage]})</span>
      </h1>
      <CandidateForm action={updateCandidateAction} jobId={ids.data.id} submitLabel="Save changes" candidate={c} />
    </section>
  );
}
