import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { jobs, user } from "@/db/schema";
import { requireAnyRole } from "@/lib/dal";
import { JOB_STATUSES, JOB_STATUS_LABEL, type JobStatus } from "@/lib/validation/job";

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAnyRole(["admin", "recruiter"]);
  const { status } = await searchParams;
  const filter = (JOB_STATUSES as readonly string[]).includes(status ?? "") ? (status as JobStatus) : null;
  const showAll = status === "all";
  const active: JobStatus | "all" = showAll ? "all" : (filter ?? "open");

  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      department: jobs.department,
      rounds: jobs.rounds,
      status: jobs.status,
      createdAt: jobs.createdAt,
      createdBy: user.name,
    })
    .from(jobs)
    .innerJoin(user, eq(jobs.createdBy, user.id))
    .where(active === "all" ? undefined : eq(jobs.status, active))
    .orderBy(desc(jobs.createdAt));

  const tabs: { key: JobStatus | "all"; label: string }[] = [
    ...JOB_STATUSES.map((s) => ({ key: s, label: JOB_STATUS_LABEL[s] })),
    { key: "all", label: "All" },
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Jobs</h1>
        <Link href="/jobs/new" className="rounded bg-black px-4 py-2 text-sm text-white">New job</Link>
      </div>
      <nav className="flex gap-3 text-sm">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/jobs?status=${t.key}`}
            className={t.key === active ? "font-semibold underline" : "underline opacity-70"}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="text-sm">No jobs here yet.</p>
      ) : (
        <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
          <thead>
            <tr className="border-b">
              <th className="py-2">Title</th>
              <th>Department</th>
              <th>Rounds</th>
              <th>Status</th>
              <th>Created by</th>
              <th>Created</th>
              <th>Candidates</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => (
              <tr key={j.id} className="border-b">
                <td className="py-2"><Link href={`/jobs/${j.id}`} className="underline">{j.title}</Link></td>
                <td>{j.department}</td>
                <td>{j.rounds}</td>
                <td>{JOB_STATUS_LABEL[j.status]}</td>
                <td>{j.createdBy}</td>
                <td>{j.createdAt.toLocaleDateString("en-GB")}</td>
                <td><Link href={`/jobs/${j.id}/candidates`} className="underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
