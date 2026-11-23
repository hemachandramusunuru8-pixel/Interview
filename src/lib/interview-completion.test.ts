import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  logActivity: vi.fn(),
  interviewReturning: vi.fn(),
  deliveryInsert: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/activity", () => ({ logActivity: (...args: unknown[]) => mocks.logActivity(...args) }));
vi.mock("@/db", () => ({ db: { transaction: (...args: unknown[]) => mocks.transaction(...args) } }));

import { completeInterview } from "./interview-completion";

function transactionWriter() {
  const interviewWhere = vi.fn(() => ({ returning: mocks.interviewReturning }));
  const interviewSet = vi.fn(() => ({ where: interviewWhere }));
  const candidateWhere = vi.fn().mockResolvedValue(undefined);
  const candidateSet = vi.fn(() => ({ where: candidateWhere }));
  const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
  mocks.deliveryInsert.mockReturnValue({ onConflictDoNothing });
  const tx = {
    update: vi.fn()
      .mockReturnValueOnce({ set: interviewSet })
      .mockReturnValueOnce({ set: candidateSet }),
    insert: vi.fn(() => ({ values: mocks.deliveryInsert })),
  };
  mocks.transaction.mockImplementation(async (work: (writer: typeof tx) => Promise<boolean>) => work(tx));
  return { tx, interviewSet, candidateSet, onConflictDoNothing };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.interviewReturning.mockResolvedValue([{ candidateId: "candidate-1", scheduleRevision: 2 }]);
  mocks.logActivity.mockResolvedValue(undefined);
});

describe("completeInterview", () => {
  it("atomically completes an assigned interview without sending a redundant request to the initiating panelist", async () => {
    const { tx, interviewSet, candidateSet } = transactionWriter();

    await expect(completeInterview({
      interviewId: "11111111-1111-4111-8111-111111111111",
      actorId: "panelist-1",
      panelistId: "panelist-1",
    })).resolves.toBe(true);

    expect(interviewSet).toHaveBeenCalledWith(expect.objectContaining({ status: "completed" }));
    expect(candidateSet).toHaveBeenCalledWith({ stage: "interview_done" });
    expect(tx.insert).not.toHaveBeenCalled();
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "panelist-1", details: { source: "panelist" } }),
      tx,
    );
  });

  it("enqueues a durable feedback request when the scheduler completes the interview", async () => {
    const { tx, onConflictDoNothing } = transactionWriter();

    await expect(completeInterview({
      interviewId: "11111111-1111-4111-8111-111111111111",
      actorId: null,
      enqueueFeedbackRequest: true,
    })).resolves.toBe(true);

    expect(tx.insert).toHaveBeenCalledOnce();
    expect(mocks.deliveryInsert).toHaveBeenCalledWith(expect.objectContaining({ kind: "feedback_request", recipient: "panelist" }));
    expect(onConflictDoNothing).toHaveBeenCalledOnce();
  });

  it("records the actual Teams end time and webhook audit source", async () => {
    const { tx, interviewSet } = transactionWriter();
    const endedAt = new Date("2030-06-01T10:30:00.000Z");

    await expect(completeInterview({
      interviewId: "11111111-1111-4111-8111-111111111111",
      actorId: null,
      completedAt: endedAt,
      actualEndedAt: endedAt,
      source: "teams_webhook",
      enqueueFeedbackRequest: true,
    })).resolves.toBe(true);

    expect(interviewSet).toHaveBeenCalledWith(expect.objectContaining({ actualEndedAt: endedAt }));
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ details: { source: "teams_webhook" } }),
      tx,
    );
  });

  it("does nothing when another transition already completed or cancelled the interview", async () => {
    const { tx } = transactionWriter();
    mocks.interviewReturning.mockResolvedValue([]);

    await expect(completeInterview({
      interviewId: "11111111-1111-4111-8111-111111111111",
      actorId: "panelist-1",
      panelistId: "panelist-1",
    })).resolves.toBe(false);

    expect(tx.update).toHaveBeenCalledOnce();
    expect(mocks.logActivity).not.toHaveBeenCalled();
  });
});
