import { and, asc, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm";
import { db } from "@/db";
import { candidates, interviews, jobs } from "@/db/schema";
import { ClockIcon, InboxIcon, LayersIcon } from "@/components/icons";
import { Avatar, Badge, Card, CardHeader, EmptyState, PageHeader, SkillTags } from "@/components/ui";
import { requireRole } from "@/lib/dal";
import { formatInZone } from "@/lib/time";
import { PickCandidateForm, PickSlotForm } from "./forms";

export const metadata = { title: "Pipeline" };

export default async function PipelinePage() {
  await requireRole("panelist");

  // Slots a recruiter opened with a set date and time: first panelist to pick wins.
  const slots = await db
    .select({
      i: interviews,
      candidateName: candidates.name,
      experienceYears: candidates.experienceYears,
      skills: candidates.skills,
      jobTitle: jobs.title,
    })
    .from(interviews)
    .innerJoin(candidates, eq(interviews.candidateId, candidates.id))
    .innerJoin(jobs, eq(interviews.jobId, jobs.id))
    .where(
      and(
        eq(interviews.mode, "pipeline"),
        eq(interviews.status, "pending"),
        isNull(interviews.panelistId),
        gt(interviews.startsAt, new Date()),
      ),
    )
    .orderBy(asc(interviews.startsAt));

  // Candidates waiting for an interview with no time set: the panelist who picks one chooses the time.
  const completedCount = sql<number>`(select count(*)::int from interviews i where i.candidate_id = ${candidates.id} and i.status = 'completed')`;
  const waiting = await db
    .select({
      id: candidates.id,
      name: candidates.name,
      experienceYears: candidates.experienceYears,
      currentCompany: candidates.currentCompany,
      skills: candidates.skills,
      jobTitle: jobs.title,
      totalRounds: jobs.rounds,
      done: completedCount,
    })
    .from(candidates)
    .innerJoin(jobs, eq(candidates.jobId, jobs.id))
    .where(
      and(
        eq(jobs.status, "open"),
        inArray(candidates.stage, ["uploaded", "next_round"]),
        notExists(
          db
            .select({ x: sql`1` })
            .from(interviews)
            .where(and(eq(interviews.candidateId, candidates.id), inArray(interviews.status, ["pending", "scheduled"]))),
        ),
        sql`${completedCount} < ${jobs.rounds}`,
      ),
    )
    .orderBy(asc(candidates.createdAt));

  return (
    <>
      <PageHeader
        title="Pipeline"
        description="Candidates waiting for an interview. The first panelist to pick one takes it, and everyone is invited on Teams."
      />

      <Card className="mb-6">
        <CardHeader
          title={<span className="flex items-center gap-2">Open slots <Badge tone="teal">{slots.length}</Badge></span>}
          description="A recruiter set the date and time. Pick one and it is yours."
        />
        {slots.length === 0 ? (
          <EmptyState icon={<ClockIcon width={22} height={22} />} title="No open slots right now." />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {slots.map((r) => (
              <div key={r.i.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={r.candidateName} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{r.candidateName}</p>
                    <p className="truncate text-xs text-slate-500">{r.jobTitle} · Round {r.i.round}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
                  <ClockIcon width={16} height={16} />
                  {formatInZone(r.i.startsAt, r.i.timeZone)}
                </div>
                <div className="text-xs text-slate-500">{r.experienceYears} years experience</div>
                <SkillTags skills={r.skills} max={4} />
                <div className="mt-auto pt-1"><PickSlotForm interviewId={r.i.id} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title={<span className="flex items-center gap-2">Waiting candidates <Badge tone="amber">{waiting.length}</Badge></span>}
          description="No time is set yet. Pick a candidate and choose a time that suits you."
        />
        {waiting.length === 0 ? (
          <EmptyState icon={<InboxIcon width={22} height={22} />} title="No candidates are waiting." description="New candidates appear here as recruiters add them." />
        ) : (
          <div className="grid grid-cols-1 gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
            {waiting.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{c.name}</p>
                    <p className="truncate text-xs text-slate-500">{c.jobTitle}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge tone="indigo"><LayersIcon width={12} height={12} />Round {c.done + 1} of {c.totalRounds}</Badge>
                  <span>{c.experienceYears} yrs{c.currentCompany ? ` · ${c.currentCompany}` : ""}</span>
                </div>
                <SkillTags skills={c.skills} max={4} />
                <div className="mt-auto pt-1"><PickCandidateForm candidateId={c.id} /></div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
