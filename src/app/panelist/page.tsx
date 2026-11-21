import Link from "next/link";
import { CalendarIcon, ClipboardIcon, InboxIcon, LayersIcon } from "@/components/icons";
import { InterviewList } from "@/components/InterviewList";
import { ButtonLink, Card, CardHeader, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { panelistDashboard } from "@/lib/dashboard";
import { requireRole } from "@/lib/dal";
import { completeEndedInterviews } from "@/lib/scheduled-jobs";
import { formatInZone } from "@/lib/time";

export const metadata = { title: "Dashboard" };

export default async function PanelistHome() {
  const { user } = await requireRole("panelist");
  await completeEndedInterviews().catch((err) => console.error("completeEndedInterviews failed:", err));
  const d = await panelistDashboard(user.id);

  return (
    <>
      <PageHeader
        title={`Good to see you, ${user.name.split(" ")[0]}`}
        description="Your interviews, requests and feedback."
        actions={<ButtonLink href="/panelist/pipeline"><LayersIcon width={16} height={16} />Open pipeline</ButtonLink>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Requests for you" value={d.requests} hint="Accept or decline" icon={<InboxIcon />} href="/panelist/interviews" tone="amber" />
        <StatCard label="Upcoming interviews" value={d.upcoming} icon={<CalendarIcon />} href="/panelist/interviews" tone="blue" />
        <StatCard label="Feedback due" value={d.feedbackDue} icon={<ClipboardIcon />} href="/panelist/interviews" tone="purple" />
        <StatCard label="Open in pipeline" value={d.pipeline} hint="First to pick takes it" icon={<LayersIcon />} href="/panelist/pipeline" tone="green" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Requests waiting for you"
            action={<Link href="/panelist/interviews" className="text-sm font-medium text-brand-600 hover:text-brand-700">Respond</Link>}
          />
          {d.requestList.length === 0 ? (
            <EmptyState icon={<InboxIcon width={22} height={22} />} title="No requests right now." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.requestList.map((r) => (
                <li key={r.id}>
                  <Link href="/panelist/interviews" className="block px-5 py-3 hover:bg-slate-50">
                    <p className="text-sm font-medium text-slate-900">{r.candidateName}</p>
                    <p className="text-xs text-slate-500">{r.jobTitle} · Round {r.round} · {formatInZone(r.startsAt, r.timeZone)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Your upcoming interviews" />
          <InterviewList items={d.next} emptyText="Nothing scheduled yet." />
        </Card>
      </div>
    </>
  );
}
