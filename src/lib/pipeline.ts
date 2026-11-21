import type { CandidateStage } from "@/lib/validation/candidate";

type Input = {
  stage: CandidateStage;
  jobStatus: "open" | "on_hold" | "closed";
  hasLiveInterview: boolean; // a pending or scheduled interview already exists
  completedRounds: number;
  totalRounds: number;
};

export type Eligibility = { ok: true; round: number } | { ok: false; reason: string };

/**
 * A candidate is "waiting" in the pipeline when their job is open, they are ready for an interview
 * (new, or cleared for the next round), nobody has already taken or requested a slot, and a round is left.
 */
export function pipelineEligibility(s: Input): Eligibility {
  if (s.jobStatus !== "open") return { ok: false, reason: "This job is not open." };
  if (s.stage !== "uploaded" && s.stage !== "next_round") {
    return { ok: false, reason: "This candidate is not waiting for an interview." };
  }
  if (s.hasLiveInterview) return { ok: false, reason: "Someone has already taken or requested this interview." };
  const round = s.completedRounds + 1;
  if (round > s.totalRounds) return { ok: false, reason: "This candidate has finished every round." };
  return { ok: true, round };
}
