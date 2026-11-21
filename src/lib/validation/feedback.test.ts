import { describe, expect, it } from "vitest";
import { feedbackSchema } from "./feedback";

const valid = {
  interviewId: "11111111-1111-4111-8111-111111111111",
  rating: "4",
  recommendation: "move_forward",
  comments: "  Strong on fundamentals.  ",
};

describe("feedbackSchema", () => {
  it("accepts valid feedback and trims the comments", () => {
    const r = feedbackSchema.parse(valid);
    expect(r.rating).toBe(4);
    expect(r.comments).toBe("Strong on fundamentals.");
  });

  it.each(["move_forward", "hold", "reject"])("accepts recommendation %s", (recommendation) => {
    expect(feedbackSchema.safeParse({ ...valid, recommendation }).success).toBe(true);
  });

  it.each([
    ["rating 0", { rating: "0" }],
    ["rating 6", { rating: "6" }],
    ["fractional rating", { rating: "3.5" }],
    ["missing rating", { rating: "" }],
    ["unknown recommendation", { recommendation: "maybe" }],
    ["empty comments", { comments: "   " }],
    ["comments over 3000 characters", { comments: "x".repeat(3001) }],
    ["bad interview id", { interviewId: "nope" }],
  ])("rejects %s", (_n, override) => {
    expect(feedbackSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });
});
