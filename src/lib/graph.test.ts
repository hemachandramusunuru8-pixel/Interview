import { describe, expect, it } from "vitest";
import { buildEventPayload } from "./graph";

describe("buildEventPayload", () => {
  const payload = buildEventPayload({
    transactionId: "interview-1",
    subject: "Interview",
    html: "<p>x</p>",
    startsAt: new Date("2030-06-01T04:30:00.000Z"),
    endsAt: new Date("2030-06-01T05:30:00.000Z"),
    attendees: [
      { name: "Rec", email: "rec@example.com" },
      { name: "Pan", email: "pan@example.com" },
      { name: "Cand", email: "cand@example.com" },
    ],
  });

  it("asks for a Teams meeting", () => {
    expect(payload.isOnlineMeeting).toBe(true);
    expect(payload.onlineMeetingProvider).toBe("teamsForBusiness");
  });

  it("uses the stable booking id to deduplicate retries", () => {
    expect(payload.transactionId).toBe("interview-1");
  });

  it("sends times as UTC wall-clock without milliseconds", () => {
    expect(payload.start).toEqual({ dateTime: "2030-06-01T04:30:00", timeZone: "UTC" });
    expect(payload.end).toEqual({ dateTime: "2030-06-01T05:30:00", timeZone: "UTC" });
  });

  it("invites all three people as required attendees", () => {
    expect(payload.attendees.map((a) => a.emailAddress.address)).toEqual([
      "rec@example.com",
      "pan@example.com",
      "cand@example.com",
    ]);
    expect(payload.attendees.every((a) => a.type === "required")).toBe(true);
  });
});
