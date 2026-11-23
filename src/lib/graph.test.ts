import { describe, expect, it } from "vitest";
import { buildEventPayload, buildMeetingCallSubscriptionPayload } from "./graph";

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

describe("buildMeetingCallSubscriptionPayload", () => {
  it("requests encrypted rich call-event notifications for the exact Teams join URL", () => {
    const payload = buildMeetingCallSubscriptionPayload({
      joinUrl: "https://teams.microsoft.com/l/meetup-join/19:meeting_x@thread.v2/0?context=%7B%7D",
      notificationUrl: "https://app.example.com/api/webhooks/graph/meeting-events",
      expirationDateTime: "2030-06-03T12:00:00.000Z",
      clientState: "secret",
      encryptionCertificate: "certificate",
      encryptionCertificateId: "cert-1",
    });

    expect(payload.includeResourceData).toBe(true);
    expect(payload.resource).toContain("/meetingCallEvents");
    expect(payload.resource).toContain(encodeURIComponent("https://teams.microsoft.com/l/meetup-join/19:meeting_x@thread.v2/0?context=%7B%7D"));
    expect(payload.notificationUrl).toBe("https://app.example.com/api/webhooks/graph/meeting-events");
  });
});
