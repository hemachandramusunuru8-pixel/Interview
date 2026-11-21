import type { CandidateStage } from "@/lib/validation/candidate";
import type { Outcome } from "@/lib/emails";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  next_round: "Move to next round",
  selected: "Select",
  rejected: "Reject",
};

type State = {
  stage: CandidateStage;
  completedRounds: number; // rounds already held
  totalRounds: number; // rounds the job has
  hasFeedback: boolean; // feedback exists for the latest completed round
};

/**
 * The decisions a recruiter may take right now. A decision is only possible after an interview is
 * done and its feedback has been submitted. "Next round" needs a round left to hold.
 */
export function allowedOutcomes(s: State): Outcome[] {
  if (s.stage !== "interview_done" || !s.hasFeedback || s.completedRounds < 1) return [];
  const outcomes: Outcome[] = [];
  if (s.completedRounds < s.totalRounds) outcomes.push("next_round");
  outcomes.push("selected", "rejected");
  return outcomes;
}

/** The candidate stage each decision leads to. */
export const OUTCOME_STAGE: Record<Outcome, CandidateStage> = {
  next_round: "next_round",
  selected: "selected",
  rejected: "rejected",
};
