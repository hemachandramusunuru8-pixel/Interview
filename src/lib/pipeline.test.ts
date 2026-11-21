import { describe, expect, it } from "vitest";
import { pipelineEligibility } from "./pipeline";

const base = { stage: "uploaded", jobStatus: "open", hasLiveInterview: false, completedRounds: 0, totalRounds: 3 } as const;

describe("pipelineEligibility", () => {
  it("a new candidate on an open job waits for round 1", () => {
    expect(pipelineEligibility(base)).toEqual({ ok: true, round: 1 });
  });

  it("a candidate cleared for the next round waits for round 2", () => {
    expect(pipelineEligibility({ ...base, stage: "next_round", completedRounds: 1 })).toEqual({ ok: true, round: 2 });
  });

  it.each(["on_hold", "closed"] as const)("is not available when the job is %s", (jobStatus) => {
    expect(pipelineEligibility({ ...base, jobStatus }).ok).toBe(false);
  });

  it.each(["interview_scheduled", "interview_done", "selected", "rejected"] as const)(
    "is not available at stage %s",
    (stage) => {
      expect(pipelineEligibility({ ...base, stage }).ok).toBe(false);
    },
  );

  it("is not available once someone already holds a live interview", () => {
    expect(pipelineEligibility({ ...base, hasLiveInterview: true }).ok).toBe(false);
  });

  it("is not available after the final round", () => {
    expect(pipelineEligibility({ ...base, stage: "next_round", completedRounds: 3 }).ok).toBe(false);
  });
});
