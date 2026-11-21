import Link from "next/link";
import { BriefcaseIcon, CalendarIcon, ClipboardIcon, InboxIcon, UsersIcon } from "@/components/icons";
import { InterviewList } from "@/components/InterviewList";
import { RecommendationBadge, StageBadge } from "@/components/status";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { recruiterDashboard, timeAgo } from "@/lib/dashboard";
import { requireRole } from "@/lib/dal";

export const metadata = { title: "Dashboard" };

export default async function RecruiterHome() {
  const { user } = await requireRole("recruiter");
  const d = await recruiterDashboard();

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="Your hiring pipeline at a glance."
        actions={<ButtonLink href="/jobs/new"><BriefcaseIcon width={16} height={16} />New job</ButtonLink>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open jobs" value={d.openJobs} icon={<BriefcaseIcon />} href="/jobs" />
        <StatCard label="Waiting for an interview" value={d.waiting} hint="New or cleared for the next round" icon={<InboxIcon />} tone="amber" />
        <StatCard label="Upcoming interviews" value={d.upcoming} icon={<CalendarIcon />} tone="blue" />
        <StatCard label="Need your decision" value={d.decisionsCount} hint="Feedback is in" icon={<ClipboardIcon />} tone="purple" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Needs your decision" description="Feedback has been submitted. Move them on, select or reject." />
          {d.decisions.length === 0 ? (
            <EmptyState icon={<ClipboardIcon width={22} height={22} />} title="You are all caught up." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.decisions.map((c) => (
                <li key={`${c.candidateId}-${c.round}`}>
                  <Link
                    href={`/jobs/${c.jobId}/candidates/${c.candidateId}/interviews`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{c.candidateName}</p>
                      <p className="truncate text-xs text-slate-500">{c.jobTitle} · Round {c.round} · {c.rating}/5</p>
                    </div>
                    <RecommendationBadge value={c.recommendation} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Upcoming interviews" />
          <InterviewList
            items={d.next.map((i) => ({ ...i, href: `/jobs/${i.jobId}/candidates/${i.candidateId}/interviews` }))}
            emptyText="No interviews are booked yet."
          />
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recently added candidates"
          action={<Link href="/jobs" className="text-sm font-medium text-brand-600 hover:text-brand-700">All jobs</Link>}
        />
        {d.recentCandidates.length === 0 ? (
          <EmptyState
            icon={<UsersIcon width={22} height={22} />}
            title="No candidates yet"
            description="Open a job and add your first candidate."
            action={<ButtonLink href="/jobs" variant="secondary">Go to jobs</ButtonLink>}
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {d.recentCandidates.map((c) => (
              <li key={c.id}>
                <Link href={`/jobs/${c.jobId}/candidates/${c.id}/interviews`} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-xs text-slate-500">{c.jobTitle} · added {timeAgo(c.createdAt)}</p>
                  </div>
                  <StageBadge stage={c.stage} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
