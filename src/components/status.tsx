// Consistent colour coding for every status in the app.
import { Badge, type Tone } from "@/components/ui";
import { STAGE_LABEL, type CandidateStage } from "@/lib/validation/candidate";
import { INTERVIEW_STATUS_LABEL } from "@/lib/validation/interview";
import { JOB_STATUS_LABEL, type JobStatus } from "@/lib/validation/job";

const JOB_TONE: Record<JobStatus, Tone> = { open: "green", on_hold: "amber", closed: "gray" };
export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge tone={JOB_TONE[status]} dot>{JOB_STATUS_LABEL[status]}</Badge>;
}

const STAGE_TONE: Record<CandidateStage, Tone> = {
  uploaded: "gray",
  interview_scheduled: "blue",
  interview_done: "purple",
  next_round: "indigo",
  selected: "green",
  rejected: "red",
};
export function StageBadge({ stage }: { stage: CandidateStage }) {
  return <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>;
}

type InterviewStatus = keyof typeof INTERVIEW_STATUS_LABEL;
const INTERVIEW_TONE: Record<InterviewStatus, Tone> = {
  pending: "amber",
  scheduled: "blue",
  declined: "red",
  cancelled: "gray",
  completed: "green",
};
export function InterviewStatusBadge({ status, openPipeline }: { status: InterviewStatus; openPipeline?: boolean }) {
  if (status === "pending" && openPipeline) return <Badge tone="teal" dot>Open in pipeline</Badge>;
  return <Badge tone={INTERVIEW_TONE[status]} dot>{INTERVIEW_STATUS_LABEL[status]}</Badge>;
}

const REC_TONE = { move_forward: "green", hold: "amber", reject: "red" } as const;
const REC_LABEL = { move_forward: "Move forward", hold: "Hold", reject: "Reject" } as const;
export function RecommendationBadge({ value }: { value: keyof typeof REC_TONE }) {
  return <Badge tone={REC_TONE[value]}>{REC_LABEL[value]}</Badge>;
}

const ROLE_TONE = { admin: "purple", recruiter: "indigo", panelist: "teal" } as const;
const ROLE_LABEL = { admin: "Admin", recruiter: "Recruiter", panelist: "Panelist" } as const;
export function RoleBadge({ role }: { role: string | null }) {
  const r = (role ?? "recruiter") as keyof typeof ROLE_TONE;
  return <Badge tone={ROLE_TONE[r] ?? "gray"}>{ROLE_LABEL[r] ?? role}</Badge>;
}

export function Rating({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= value ? "text-amber-400" : "text-slate-200"}>★</span>
      ))}
      <span className="ml-1 text-xs text-slate-500">{value}/5</span>
    </span>
  );
}
