import { describe, expect, it } from "vitest";
import { allowedOutcomes } from "./outcomes";

const base = { stage: "interview_done", completedRounds: 1, totalRounds: 3, hasFeedback: true } as const;

describe("allowedOutcomes", () => {
  it("offers all three decisions after round 1 of 3 once feedback is in", () => {
    expect(allowedOutcomes(base)).toEqual(["next_round", "selected", "rejected"]);
  });

  it("does not offer next round after the final round", () => {
    expect(allowedOutcomes({ ...base, completedRounds: 3 })).toEqual(["selected", "rejected"]);
  });

  it("offers nothing until feedback has been submitted", () => {
    expect(allowedOutcomes({ ...base, hasFeedback: false })).toEqual([]);
  });

  it.each(["uploaded", "interview_scheduled", "next_round", "selected", "rejected"] as const)(
    "offers nothing while the candidate is at stage %s",
    (stage) => {
      expect(allowedOutcomes({ ...base, stage })).toEqual([]);
    },
  );

  it("offers nothing when no round has been completed", () => {
    expect(allowedOutcomes({ ...base, completedRounds: 0 })).toEqual([]);
  });
});
