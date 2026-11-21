import Link from "next/link";
import { ActivityIcon, BriefcaseIcon, CalendarIcon, ClockIcon, UserPlusIcon, UsersIcon } from "@/components/icons";
import { InterviewList } from "@/components/InterviewList";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { adminDashboard, describeAction, timeAgo } from "@/lib/dashboard";
import { requireRole } from "@/lib/dal";

export const metadata = { title: "Dashboard" };

export default async function AdminHome() {
  const { user } = await requireRole("admin");
  const d = await adminDashboard();
  const team = d.users.recruiter + d.users.panelist + d.users.admin;

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="An overview of hiring across your organisation."
        actions={
          <>
            <ButtonLink href="/admin/users" variant="secondary"><UserPlusIcon width={16} height={16} />Add user</ButtonLink>
            <ButtonLink href="/jobs/new"><BriefcaseIcon width={16} height={16} />New job</ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active team" value={team} hint={`${d.users.recruiter} recruiters · ${d.users.panelist} panelists`} icon={<UsersIcon />} href="/admin/users" />
        <StatCard label="Open jobs" value={d.openJobs} hint={`${d.candidates} candidates in total`} icon={<BriefcaseIcon />} href="/jobs" tone="green" />
        <StatCard label="Upcoming interviews" value={d.upcoming} hint="Booked on Teams" icon={<CalendarIcon />} tone="blue" />
        <StatCard label="Awaiting a panelist" value={d.pending} hint="Requests and open slots" icon={<ClockIcon />} tone="amber" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Upcoming interviews" description="The next interviews across all jobs." />
          <InterviewList
            items={d.next.map((i) => ({ ...i, href: `/jobs/${i.jobId}/candidates/${i.candidateId}/interviews` }))}
            emptyText="No interviews are booked yet."
          />
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Recent activity"
            action={<Link href="/admin/activity" className="text-sm font-medium text-brand-600 hover:text-brand-700">View all</Link>}
          />
          {d.recent.length === 0 ? (
            <EmptyState icon={<ActivityIcon width={22} height={22} />} title="Nothing has happened yet." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.recent.map((a) => (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{describeAction(a.action)}</p>
                    <p className="text-xs text-slate-500">{a.actorName ?? "System"} · {timeAgo(a.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
