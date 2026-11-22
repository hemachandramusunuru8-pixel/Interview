import { notFound } from "next/navigation";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { candidates, feedback, interviews, jobs, user } from "@/db/schema";
import { CalendarIcon, FileIcon, MailIcon, VideoIcon } from "@/components/icons";
import { InterviewStatusBadge, Rating, RecommendationBadge, StageBadge } from "@/components/status";
import { Avatar, ButtonLink, Card, CardBody, CardHeader, EmptyState, Notice, PageHeader, SkillTags, buttonClass } from "@/components/ui";
import { requireAnyRole } from "@/lib/dal";
import { completedRounds } from "@/lib/interviews";
import { allowedOutcomes } from "@/lib/outcomes";
import { completeEndedInterviews } from "@/lib/scheduled-jobs";
import { recordingsFor, syncRecordings } from "@/lib/recordings";
import { formatInZone } from "@/lib/time";
import { CancelForm, OutcomeForm, RescheduleForm, SchedulePanel } from "./forms";

export const metadata = { title: "Interviews" };

export default async function CandidateInterviewsPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  await requireAnyRole(["admin", "recruiter"]);
  const ids = z
    .object({ id: z.string().uuid(), candidateId: z.string().uuid() })
    .safeParse(await params);
  if (!ids.success) notFound();

  await completeEndedInterviews().catch((err) => console.error("completeEndedInterviews failed:", err));

  const [cand] = await db
    .select()
    .from(candidates)
    .where(and(eq(candidates.id, ids.data.candidateId), eq(candidates.jobId, ids.data.id)));
  if (!cand) notFound();
  const [job] = await db.select().from(jobs).where(eq(jobs.id, cand.jobId));

  const list = await db
    .select({ i: interviews, panelistName: user.name })
    .from(interviews)
    .leftJoin(user, eq(interviews.panelistId, user.id))
    .where(eq(interviews.candidateId, cand.id))
    .orderBy(desc(interviews.createdAt));

  const feedbackRows = await db
    .select()
    .from(feedback)
    .innerJoin(interviews, eq(feedback.interviewId, interviews.id))
    .where(eq(interviews.candidateId, cand.id));
  const feedbackByInterview = new Map(feedbackRows.map((r) => [r.feedback.interviewId, r.feedback]));

  // Save any new Teams recordings for this candidate's recently ended interviews (checked at most every 5 minutes).
  await syncRecordings({ candidateId: cand.id }).catch((err) => console.error("syncRecordings failed:", err));
  const recordingsByInterview = new Map<string, Awaited<ReturnType<typeof recordingsFor>>>();
  for (const r of await recordingsFor(list.map((x) => x.i.id))) {
    recordingsByInterview.set(r.interviewId, [...(recordingsByInterview.get(r.interviewId) ?? []), r]);
  }

  const live = list.find((r) => r.i.status === "pending" || r.i.status === "scheduled");
  const done = await completedRounds(cand.id);
  const nextRound = done + 1;
  const latestDone = list.find((r) => r.i.status === "completed" && r.i.round === done);
  const outcomes = allowedOutcomes({
    stage: cand.stage,
    completedRounds: done,
    totalRounds: job.rounds,
    hasFeedback: latestDone ? feedbackByInterview.has(latestDone.i.id) : false,
  });
  const canSchedule =
    !live && job.status === "open" && (cand.stage === "uploaded" || cand.stage === "next_round") && nextRound <= job.rounds;

  const panelists = canSchedule
    ? await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(and(eq(user.role, "panelist"), eq(user.banned, false)))
        .orderBy(asc(user.name))
    : [];

  const progress = Math.min(100, Math.round((done / job.rounds) * 100));

  return (
    <>
      <PageHeader
        back={{ href: `/jobs/${job.id}/candidates`, label: job.title }}
        title={<span className="flex flex-wrap items-center gap-3">{cand.name} <StageBadge stage={cand.stage} /></span>}
        description={`${job.title} · ${job.department}`}
        actions={<ButtonLink href={`/jobs/${job.id}/candidates/${cand.id}`} variant="secondary">Edit candidate</ButtonLink>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          {outcomes.length > 0 && (
            <Card className="border-brand-200 ring-1 ring-brand-100">
              <CardHeader title="Your decision" description={`Round ${done} feedback is in. Choose what happens next.`} />
              <CardBody>
                <OutcomeForm jobId={job.id} candidateId={cand.id} options={outcomes} />
              </CardBody>
            </Card>
          )}

          {cand.stage === "interview_done" && outcomes.length === 0 && (
            <Notice tone="amber">Waiting for the panelist&apos;s feedback before you can decide.</Notice>
          )}

          {canSchedule ? (
            <Card>
              <CardHeader
                title={`Schedule round ${nextRound}`}
                description="Until you book it, this candidate also waits in the pipeline, where any panelist can pick them and choose the time."
              />
              <CardBody>
                <SchedulePanel jobId={job.id} candidateId={cand.id} round={nextRound} panelists={panelists} />
              </CardBody>
            </Card>
          ) : (
            !live &&
            outcomes.length === 0 &&
            cand.stage !== "interview_done" && (
              <Notice>
                {cand.stage === "selected"
                  ? "This candidate has been selected."
                  : cand.stage === "rejected"
                    ? "This candidate has been rejected."
                    : job.status !== "open"
                      ? "The job is not open, so no new interviews can be booked."
                      : "No interview can be booked for this candidate right now."}
              </Notice>
            )
          )}

          <Card>
            <CardHeader title="Interview history" description={`${list.length} interview${list.length === 1 ? "" : "s"} for this candidate.`} />
            {list.length === 0 ? (
              <EmptyState icon={<CalendarIcon width={22} height={22} />} title="No interviews yet" />
            ) : (
              <ol className="divide-y divide-slate-100">
                {list.map(({ i, panelistName }) => {
                  const isLive = i.status === "pending" || i.status === "scheduled";
                  const fb = feedbackByInterview.get(i.id);
                  const openPipeline = i.mode === "pipeline" && !i.panelistId;
                  return (
                    <li key={i.id} className="flex flex-col gap-3 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                            R{i.round}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-slate-900">{formatInZone(i.startsAt, i.timeZone)}</p>
                            <p className="text-xs text-slate-500">
                              {openPipeline ? "Open in the pipeline: any panelist can pick it" : `Panelist: ${panelistName ?? "-"}`}
                              {i.mode === "pipeline" && !openPipeline ? " · via pipeline" : ""}
                            </p>
                          </div>
                        </div>
                        <InterviewStatusBadge status={i.status} openPipeline={openPipeline} />
                      </div>

                      {i.status === "declined" && (
                        <p className="text-sm text-slate-600">
                          Declined{i.declineReason ? `: “${i.declineReason}”` : ""}. Send it to another panelist or post it to the pipeline.
                        </p>
                      )}

                      {fb ? (
                        <div className="rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
                          <div className="flex flex-wrap items-center gap-3">
                            <Rating value={fb.rating} />
                            <RecommendationBadge value={fb.recommendation} />
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{fb.comments}</p>
                        </div>
                      ) : i.status === "completed" ? (
                        <p className="text-sm text-slate-500">Waiting for feedback from {panelistName}.</p>
                      ) : null}

                      {(recordingsByInterview.get(i.id) ?? []).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          {(recordingsByInterview.get(i.id) ?? []).map((rec, n, all) => (
                            <a
                              key={rec.id}
                              href={`/jobs/${job.id}/candidates/${cand.id}/interviews/recordings/${rec.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className={buttonClass("secondary", "sm")}
                            >
                              <VideoIcon width={16} height={16} />
                              {all.length > 1 ? `Watch recording ${n + 1}` : "Watch recording"}
                              {rec.startedAt && rec.endedAt
                                ? ` (${Math.max(1, Math.round((rec.endedAt.getTime() - rec.startedAt.getTime()) / 60000))} min)`
                                : ""}
                            </a>
                          ))}
                        </div>
                      )}
                      {i.teamsJoinUrl && i.endsAt < new Date() && (recordingsByInterview.get(i.id) ?? []).length === 0 && (
                        <p className="text-xs text-slate-500">
                          No Teams recording found yet. Recordings appear here a few minutes after the meeting if someone pressed Record.
                        </p>
                      )}

                      {(isLive || (i.teamsJoinUrl && i.status === "scheduled")) && (
                        <div className="flex flex-wrap items-start gap-2">
                          {i.teamsJoinUrl && i.status === "scheduled" && (
                            <a href={i.teamsJoinUrl} target="_blank" rel="noreferrer" className={buttonClass("primary", "sm")}>
                              <VideoIcon width={16} height={16} />
                              Join Teams meeting
                            </a>
                          )}
                          {isLive && <RescheduleForm interviewId={i.id} />}
                          {isLive && <CancelForm interviewId={i.id} />}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardBody className="flex flex-col gap-4 py-5">
              <div className="flex items-center gap-3">
                <Avatar name={cand.name} />
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{cand.name}</p>
                  <p className="truncate text-sm text-slate-500">{cand.currentCompany ?? "No current company"}</p>
                </div>
              </div>
              <dl className="grid grid-cols-1 gap-3 text-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <MailIcon width={16} height={16} className="text-slate-400" />
                  <span className="truncate">{cand.email}</span>
                </div>
                <div className="flex justify-between"><dt className="text-slate-500">Phone</dt><dd className="text-slate-800">{cand.phone}</dd></div>
                <div className="flex justify-between"><dt className="text-slate-500">Experience</dt><dd className="text-slate-800">{cand.experienceYears} years</dd></div>
                <div>
                  <dt className="mb-1.5 text-slate-500">Skills</dt>
                  <dd><SkillTags skills={cand.skills} max={12} /></dd>
                </div>
              </dl>
              <a
                href={`/jobs/${job.id}/candidates/${cand.id}/resume`}
                target="_blank"
                rel="noreferrer"
                className={buttonClass("secondary", "md", "w-full")}
              >
                <FileIcon width={16} height={16} />
                View resume
              </a>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-900">Rounds completed</span>
                <span className="text-slate-500">{done} of {job.rounds}</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
