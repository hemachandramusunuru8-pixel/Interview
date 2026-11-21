import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { jobs, user } from "@/db/schema";
import { BriefcaseIcon, PlusIcon } from "@/components/icons";
import { JobStatusBadge } from "@/components/status";
import { ButtonLink, Card, EmptyState, PageHeader, TD, TH, THead, TR, Table, cn } from "@/components/ui";
import { requireAnyRole } from "@/lib/dal";
import { JOB_STATUSES, JOB_STATUS_LABEL, type JobStatus } from "@/lib/validation/job";

export const metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAnyRole(["admin", "recruiter"]);
  const { status } = await searchParams;
  const filter = (JOB_STATUSES as readonly string[]).includes(status ?? "") ? (status as JobStatus) : null;
  const active: JobStatus | "all" = status === "all" ? "all" : (filter ?? "open");

  const candidateCount = sql<number>`(select count(*)::int from candidates c where c.job_id = ${jobs.id})`;
  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      department: jobs.department,
      rounds: jobs.rounds,
      status: jobs.status,
      createdAt: jobs.createdAt,
      createdBy: user.name,
      candidates: candidateCount,
    })
    .from(jobs)
    .innerJoin(user, eq(jobs.createdBy, user.id))
    .where(active === "all" ? undefined : eq(jobs.status, active))
    .orderBy(desc(jobs.createdAt));

  const counts = await db
    .select({ status: jobs.status, n: sql<number>`count(*)::int` })
    .from(jobs)
    .groupBy(jobs.status);
  const countOf = (k: JobStatus | "all") =>
    k === "all" ? counts.reduce((a, c) => a + c.n, 0) : (counts.find((c) => c.status === k)?.n ?? 0);

  const tabs: { key: JobStatus | "all"; label: string }[] = [
    ...JOB_STATUSES.map((s) => ({ key: s, label: JOB_STATUS_LABEL[s] })),
    { key: "all", label: "All" },
  ];

  return (
    <>
      <PageHeader
        title="Jobs"
        description="Create roles, track candidates and book interviews."
        actions={<ButtonLink href="/jobs/new"><PlusIcon width={16} height={16} />New job</ButtonLink>}
      />

      <div className="mb-4 inline-flex max-w-full overflow-x-auto rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/jobs?status=${t.key}`}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition",
              t.key === active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t.label}
            <span className={cn("rounded-full px-1.5 text-xs", t.key === active ? "bg-brand-50 text-brand-700" : "bg-slate-200 text-slate-600")}>
              {countOf(t.key)}
            </span>
          </Link>
        ))}
      </div>

      <Card>
        {rows.length === 0 ? (
          <EmptyState
            icon={<BriefcaseIcon width={22} height={22} />}
            title={active === "open" ? "No open jobs" : "No jobs here"}
            description="Create a job to start adding candidates."
            action={<ButtonLink href="/jobs/new"><PlusIcon width={16} height={16} />New job</ButtonLink>}
          />
        ) : (
          <Table>
            <THead>
              <tr>
                <TH>Job</TH>
                <TH>Status</TH>
                <TH>Candidates</TH>
                <TH>Rounds</TH>
                <TH>Created</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <tbody>
              {rows.map((j) => (
                <TR key={j.id}>
                  <TD>
                    <Link href={`/jobs/${j.id}/candidates`} className="font-medium text-slate-900 hover:text-brand-700">
                      {j.title}
                    </Link>
                    <p className="text-xs text-slate-500">{j.department}</p>
                  </TD>
                  <TD><JobStatusBadge status={j.status} /></TD>
                  <TD>
                    <Link href={`/jobs/${j.id}/candidates`} className="font-medium text-brand-600 hover:text-brand-700">
                      {j.candidates}
                    </Link>
                  </TD>
                  <TD>{j.rounds}</TD>
                  <TD className="whitespace-nowrap text-slate-500">
                    {j.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    <p className="text-xs text-slate-400">by {j.createdBy}</p>
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      <ButtonLink href={`/jobs/${j.id}`} variant="ghost" size="sm">Edit</ButtonLink>
                      <ButtonLink href={`/jobs/${j.id}/candidates`} variant="secondary" size="sm">Candidates</ButtonLink>
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
