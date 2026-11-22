import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadInterview: vi.fn(),
  createInterviewEvent: vi.fn(),
  getInterviewEvent: vi.fn(),
  notifyUser: vi.fn(),
  logActivity: vi.fn(),
  transaction: vi.fn(),
  outerSet: vi.fn(),
  outerWhere: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/interviews", () => ({ loadInterview: (...args: unknown[]) => mocks.loadInterview(...args) }));
vi.mock("@/lib/graph", () => ({
  createInterviewEvent: (...args: unknown[]) => mocks.createInterviewEvent(...args),
  getInterviewEvent: (...args: unknown[]) => mocks.getInterviewEvent(...args),
}));
vi.mock("@/lib/notify", () => ({ notifyUser: (...args: unknown[]) => mocks.notifyUser(...args) }));
vi.mock("@/lib/activity", () => ({ logActivity: (...args: unknown[]) => mocks.logActivity(...args) }));
vi.mock("@/db", () => ({
  db: {
    update: vi.fn(() => ({ set: mocks.outerSet })),
    transaction: (...args: unknown[]) => mocks.transaction(...args),
  },
}));

import { confirmBooking } from "./booking";

const interviewId = "11111111-1111-4111-8111-111111111111";

function context() {
  return {
    interview: {
      id: interviewId,
      candidateId: "candidate-1",
      jobId: "job-1",
      round: 1,
      status: "scheduled",
      bookingState: "creating",
      calendarState: "idle",
      graphEventId: null as string | null,
      startsAt: new Date("2030-06-01T04:30:00.000Z"),
      endsAt: new Date("2030-06-01T05:30:00.000Z"),
      timeZone: "Asia/Kolkata",
    },
    candidate: { id: "candidate-1", name: "Asha", email: "asha@example.com" },
    job: { id: "job-1", title: "Engineer" },
    panelist: { id: "panelist-1", name: "Panelist", email: "panelist@example.com" },
    recruiter: { id: "recruiter-1", name: "Recruiter", email: "recruiter@example.com" },
  };
}

function successfulTransaction() {
  const interviewReturning = vi.fn().mockResolvedValue([{ id: interviewId }]);
  const interviewWhere = vi.fn(() => ({ returning: interviewReturning }));
  const interviewSet = vi.fn(() => ({ where: interviewWhere }));
  const candidateWhere = vi.fn().mockResolvedValue(undefined);
  const candidateSet = vi.fn(() => ({ where: candidateWhere }));
  const tx = {
    update: vi.fn()
      .mockReturnValueOnce({ set: interviewSet })
      .mockReturnValueOnce({ set: candidateSet }),
  };
  mocks.transaction.mockImplementation(async (work: (writer: typeof tx) => Promise<void>) => work(tx));
  return { tx, interviewSet };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  mocks.loadInterview.mockResolvedValue(context());
  mocks.notifyUser.mockResolvedValue(undefined);
  mocks.logActivity.mockResolvedValue(undefined);
  mocks.outerSet.mockReturnValue({ where: mocks.outerWhere });
  mocks.outerWhere.mockResolvedValue(undefined);
});

describe("confirmBooking", () => {
  it("uses a stable Graph transaction id and confirms local state atomically", async () => {
    const { tx, interviewSet } = successfulTransaction();
    mocks.createInterviewEvent.mockResolvedValue({ eventId: "event-1", joinUrl: "https://teams.example/join" });

    await expect(confirmBooking(interviewId, "panelist-1", "interview.accepted")).resolves.toEqual({ ok: true });

    expect(mocks.createInterviewEvent).toHaveBeenCalledWith(
      expect.objectContaining({ transactionId: interviewId }),
    );
    expect(interviewSet).toHaveBeenCalledWith(
      expect.objectContaining({ graphEventId: "event-1", bookingState: "confirmed" }),
    );
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "interview.accepted", entityId: interviewId }),
      tx,
    );
  });

  it("keeps the claimed interview retryable when Graph fails", async () => {
    mocks.createInterviewEvent.mockRejectedValue(new Error("timeout"));

    const result = await confirmBooking(interviewId, "panelist-1", "interview.accepted");

    expect(result).toEqual({
      ok: false,
      error: "The interview is reserved for you, but the Teams invite could not be created. Retry it from My interviews.",
    });
    expect(mocks.outerSet).toHaveBeenCalledWith(expect.objectContaining({ bookingState: "failed" }));
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("preserves the event id when Graph returns no Teams link", async () => {
    mocks.createInterviewEvent.mockResolvedValue({ eventId: "event-1", joinUrl: null });

    const result = await confirmBooking(interviewId, "panelist-1", "interview.accepted");

    expect(result.ok).toBe(false);
    expect(mocks.outerSet).toHaveBeenCalledWith(expect.objectContaining({ graphEventId: "event-1", bookingState: "failed" }));
  });

  it("reloads a known Graph event instead of posting another one", async () => {
    const ctx = context();
    ctx.interview.graphEventId = "event-1";
    mocks.loadInterview.mockResolvedValue(ctx);
    successfulTransaction();
    mocks.getInterviewEvent.mockResolvedValue({ eventId: "event-1", joinUrl: "https://teams.example/join" });

    await expect(confirmBooking(interviewId, "panelist-1", "interview.booking_retried")).resolves.toEqual({ ok: true });

    expect(mocks.getInterviewEvent).toHaveBeenCalledWith("event-1");
    expect(mocks.createInterviewEvent).not.toHaveBeenCalled();
  });

  it("preserves the Graph identifiers for retry when local finalization fails", async () => {
    mocks.createInterviewEvent.mockResolvedValue({ eventId: "event-1", joinUrl: "https://teams.example/join" });
    mocks.transaction.mockRejectedValue(new Error("database unavailable"));

    const result = await confirmBooking(interviewId, "panelist-1", "interview.accepted");

    expect(result.ok).toBe(false);
    expect(mocks.outerSet).toHaveBeenCalledWith(expect.objectContaining({
      graphEventId: "event-1",
      teamsJoinUrl: "https://teams.example/join",
      bookingState: "failed",
    }));
  });
});
