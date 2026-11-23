import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, feedback, interviews, jobs } from "@/db/schema";
import { CalendarIcon, ClipboardIcon, ClockIcon, InboxIcon, VideoIcon } from "@/components/icons";
import { InterviewStatusBadge } from "@/components/status";
import { Avatar, Badge, ButtonLink, Card, CardHeader, EmptyState, PageHeader, SkillTags, buttonClass } from "@/components/ui";
import { requireRole } from "@/lib/dal";
import { formatInZone } from "@/lib/time";
import { AcceptForm, CompleteInterviewForm, DeclineForm, RetryBookingForm } from "./forms";

export const metadata = { title: "My interviews" };

export default async function PanelistInterviewsPage() {
  const { user: me } = await requireRole("panelist");

  // A panelist only ever sees their own interviews.
  const rows = await db
    .select({
      i: interviews,
      candidateName: candidates.name,
      experienceYears: candidates.experienceYears,
      skills: candidates.skills,
      jobTitle: jobs.title,
      feedbackId: feedback.id,
      bookingRetryable: sql<boolean>`${interviews.bookingState} = 'failed' or (${interviews.bookingState} = 'creating' and ${interviews.updatedAt} < now() - interval '2 minutes')`,
    })
    .from(interviews)
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .innerJoin(jobs, eq(interviews.jobId, jobs.id))
    .leftJoin(feedback, eq(feedback.interviewId, interviews.id))
    .where(and(eq(interviews.panelistId, me.id)))
    .orderBy(asc(interviews.startsAt));

  const requests = rows.filter((r) => r.i.status === "pending");
  const upcoming = rows.filter((r) => r.i.status === "scheduled");
  const feedbackDue = rows.filter((r) => r.i.status === "completed" && !r.feedbackId);
  const other = rows
    .filter((r) => !["pending", "scheduled"].includes(r.i.status) && !(r.i.status === "completed" && !r.feedbackId))
    .reverse();

  type Row = (typeof rows)[number];
  const person = (r: Row) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={r.candidateName} />
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{r.candidateName}</p>
        <p className="truncate text-xs text-slate-500">{r.jobTitle} · Round {r.i.round} · {r.experienceYears} yrs</p>
      </div>
    </div>
  );
  const when = (r: Row) => (
    <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
      <ClockIcon width={15} height={15} className="text-slate-400" />
      {formatInZone(r.i.startsAt, r.i.timeZone)}
    </span>
  );

  return (
    <>
      <PageHeader title="My interviews" description="Respond to requests, join interviews and give feedback." />

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2">Requests for you <Badge tone="amber">{requests.length}</Badge></span>}
            description="A recruiter asked you specifically. Accept to send the Teams invite to everyone."
          />
          {requests.length === 0 ? (
            <EmptyState icon={<InboxIcon width={22} height={22} />} title="No requests right now." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {requests.map((r) => (
                <li key={r.i.id} className="flex flex-col gap-4 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex flex-col gap-2">
                    {person(r)}
                    {when(r)}
                    <SkillTags skills={r.skills} max={5} />
                  </div>
                  <div className="flex flex-wrap items-start gap-2">
                    <AcceptForm interviewId={r.i.id} />
                    <DeclineForm interviewId={r.i.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={<span className="flex items-center gap-2">Scheduled <Badge tone="blue">{upcoming.length}</Badge></span>} />
          {upcoming.length === 0 ? (
            <EmptyState icon={<CalendarIcon width={22} height={22} />} title="Nothing scheduled." description="Pick a candidate from the pipeline to fill your calendar." action={<ButtonLink href="/panelist/pipeline" variant="secondary">Open pipeline</ButtonLink>} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((r) => (
                <li key={r.i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1.5">
                    {person(r)}
                    {when(r)}
                  </div>
                  <div className="flex flex-wrap items-start justify-end gap-2">
                    {r.bookingRetryable ? (
                      <RetryBookingForm interviewId={r.i.id} />
                    ) : r.i.bookingState === "creating" ? (
                      <Badge tone="amber">Creating Teams invite</Badge>
                    ) : r.i.teamsJoinUrl ? (
                      <a href={r.i.teamsJoinUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "md")}>
                        <VideoIcon width={16} height={16} />
                        Join Teams meeting
                      </a>
                    ) : null}
                    {r.i.bookingState === "confirmed" && <CompleteInterviewForm interviewId={r.i.id} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title={<span className="flex items-center gap-2">Feedback due <Badge tone="purple">{feedbackDue.length}</Badge></span>}
            description="The interview has ended. The recruiter is waiting for your view."
          />
          {feedbackDue.length === 0 ? (
            <EmptyState icon={<ClipboardIcon width={22} height={22} />} title="No feedback is waiting." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {feedbackDue.map((r) => (
                <li key={r.i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1.5">
                    {person(r)}
                    {when(r)}
                  </div>
                  <ButtonLink href={`/panelist/interviews/${r.i.id}/feedback`}>Give feedback</ButtonLink>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {other.length > 0 && (
          <Card>
            <CardHeader title="Earlier" />
            <ul className="divide-y divide-slate-100">
              {other.map((r) => (
                <li key={r.i.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-col gap-1.5">
                    {person(r)}
                    {when(r)}
                  </div>
                  <div className="flex items-center gap-3">
                    <InterviewStatusBadge status={r.i.status} />
                    {r.feedbackId && (
                      <ButtonLink href={`/panelist/interviews/${r.i.id}/feedback`} variant="ghost" size="sm">View feedback</ButtonLink>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
