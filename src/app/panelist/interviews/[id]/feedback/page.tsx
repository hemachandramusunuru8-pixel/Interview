import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { candidates, feedback, interviews, jobs } from "@/db/schema";
import { Rating, RecommendationBadge } from "@/components/status";
import { Card, CardBody, Notice, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/dal";
import { formatInZone } from "@/lib/time";
import { FeedbackForm } from "./FeedbackForm";

export const metadata = { title: "Feedback" };

export default async function FeedbackPage({ params }: { params: Promise<{ id: string }> }) {
  const { user: me } = await requireRole("panelist");
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  // Only the panelist who held this interview can open its feedback page.
  const [row] = await db
    .select({ i: interviews, candidateName: candidates.name, jobTitle: jobs.title })
    .from(interviews)
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .innerJoin(jobs, eq(interviews.jobId, jobs.id))
    .where(and(eq(interviews.id, id.data), eq(interviews.panelistId, me.id)));
  if (!row) notFound();

  const [existing] = await db.select().from(feedback).where(eq(feedback.interviewId, row.i.id));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        back={{ href: "/panelist/interviews", label: "My interviews" }}
        title={`Feedback for ${row.candidateName}`}
        description={`${row.jobTitle} · Round ${row.i.round} · ${formatInZone(row.i.startsAt, row.i.timeZone)}`}
      />
      {existing ? (
        <Card>
          <CardBody className="flex flex-col gap-4 py-6">
            <p className="text-sm text-slate-500">Submitted {existing.submittedAt.toLocaleString("en-GB")}</p>
            <div className="flex flex-wrap items-center gap-3">
              <Rating value={existing.rating} />
              <RecommendationBadge value={existing.recommendation} />
            </div>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{existing.comments}</p>
          </CardBody>
        </Card>
      ) : row.i.status === "completed" ? (
        <FeedbackForm interviewId={row.i.id} />
      ) : (
        <Notice>Feedback opens after the interview has ended.</Notice>
      )}
    </div>
  );
}
