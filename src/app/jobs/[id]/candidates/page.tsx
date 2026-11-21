import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { candidates, jobs } from "@/db/schema";
import { requireAnyRole } from "@/lib/dal";
import { JOB_STATUS_LABEL } from "@/lib/validation/job";
import { STAGE_LABEL } from "@/lib/validation/candidate";

export default async function CandidatesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAnyRole(["admin", "recruiter"]);
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) notFound();

  const [job] = await db.select().from(jobs).where(eq(jobs.id, id.data));
  if (!job) notFound();

  const rows = await db
    .select()
    .from(candidates)
    .where(eq(candidates.jobId, job.id))
    .orderBy(desc(candidates.createdAt));

  return (
    <section className="flex flex-col gap-4">
      <div>
        <Link href="/jobs" className="text-sm underline">Back to jobs</Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {job.title} <span className="text-sm font-normal opacity-70">({job.department} - {JOB_STATUS_LABEL[job.status]})</span>
          </h1>
          {job.status === "open" ? (
            <Link href={`/jobs/${job.id}/candidates/new`} className="rounded bg-black px-4 py-2 text-sm text-white">
              Add candidate
            </Link>
          ) : (
            <span className="text-sm opacity-70">Candidates can only be added to an open job.</span>
          )}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm">No candidates yet.</p>
      ) : (
        <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
          <thead>
            <tr className="border-b">
              <th className="py-2">Name</th>
              <th>Email</th>
              <th>Experience</th>
              <th>Company</th>
              <th>Stage</th>
              <th>Resume</th>
              <th>Added</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="py-2">
                  <Link href={`/jobs/${job.id}/candidates/${c.id}`} className="underline">{c.name}</Link>
                </td>
                <td>{c.email}</td>
                <td>{c.experienceYears} yrs</td>
                <td>{c.currentCompany ?? "-"}</td>
                <td>{STAGE_LABEL[c.stage]}</td>
                <td>
                  <a href={`/jobs/${job.id}/candidates/${c.id}/resume`} target="_blank" rel="noreferrer" className="underline">
                    View
                  </a>
                </td>
                <td>{c.createdAt.toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
