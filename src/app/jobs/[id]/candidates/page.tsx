import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { candidates, jobs } from "@/db/schema";
import { FileIcon, PlusIcon, UsersIcon } from "@/components/icons";
import { JobStatusBadge, StageBadge } from "@/components/status";
import { Avatar, ButtonLink, Card, EmptyState, Notice, PageHeader, SkillTags, TD, TH, THead, TR, Table } from "@/components/ui";
import { requireAnyRole } from "@/lib/dal";
import { CANDIDATE_STAGES, STAGE_LABEL } from "@/lib/validation/candidate";

export const metadata = { title: "Candidates" };

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

  const stageCounts = CANDIDATE_STAGES.map((s) => ({ stage: s, n: rows.filter((r) => r.stage === s).length })).filter(
    (s) => s.n > 0,
  );

  return (
    <>
      <PageHeader
        back={{ href: "/jobs", label: "Jobs" }}
        title={<span className="flex flex-wrap items-center gap-3">{job.title} <JobStatusBadge status={job.status} /></span>}
        description={`${job.department} · ${job.rounds} interview round${job.rounds === 1 ? "" : "s"} · ${rows.length} candidate${rows.length === 1 ? "" : "s"}`}
        actions={
          <>
            <ButtonLink href={`/jobs/${job.id}`} variant="secondary">Edit job</ButtonLink>
            {job.status === "open" && (
              <ButtonLink href={`/jobs/${job.id}/candidates/new`}><PlusIcon width={16} height={16} />Add candidate</ButtonLink>
            )}
          </>
        }
      />

      {job.status !== "open" && (
        <div className="mb-4">
          <Notice tone="amber">This job is not open, so new candidates cannot be added.</Notice>
        </div>
      )}

      {stageCounts.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {stageCounts.map((s) => (
            <span key={s.stage} className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm shadow-sm ring-1 ring-slate-200">
              <span className="text-slate-600">{STAGE_LABEL[s.stage]}</span>
              <span className="font-semibold text-slate-900">{s.n}</span>
            </span>
          ))}
        </div>
      )}

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<UsersIcon width={22} height={22} />}
            title="No candidates yet"
            description="Add a candidate with their resume. Panelists are notified that they are waiting for an interview."
            action={
              job.status === "open" ? (
                <ButtonLink href={`/jobs/${job.id}/candidates/new`}><PlusIcon width={16} height={16} />Add candidate</ButtonLink>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Candidate</TH>
                <TH>Experience</TH>
                <TH>Skills</TH>
                <TH>Stage</TH>
                <TH>Resume</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((c) => (
                <TR key={c.id}>
                  <TD>
                    <div className="flex items-center gap-3">
                      <Avatar name={c.name} size="sm" />
                      <div className="min-w-0">
                        <Link href={`/jobs/${job.id}/candidates/${c.id}/interviews`} className="block truncate font-medium text-slate-900 hover:text-brand-700">
                          {c.name}
                        </Link>
                        <p className="truncate text-xs text-slate-500">{c.email}</p>
                      </div>
                    </div>
                  </TD>
                  <TD className="whitespace-nowrap">
                    {c.experienceYears} yrs
                    <p className="text-xs text-slate-500">{c.currentCompany ?? "-"}</p>
                  </TD>
                  <TD><SkillTags skills={c.skills} max={3} /></TD>
                  <TD><StageBadge stage={c.stage} /></TD>
                  <TD>
                    <a
                      href={`/jobs/${job.id}/candidates/${c.id}/resume`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700"
                    >
                      <FileIcon width={16} height={16} />
                      View
                    </a>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <ButtonLink href={`/jobs/${job.id}/candidates/${c.id}`} variant="ghost" size="sm">Edit</ButtonLink>
                      <ButtonLink href={`/jobs/${job.id}/candidates/${c.id}/interviews`} variant="secondary" size="sm">Interviews</ButtonLink>
                    </div>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
