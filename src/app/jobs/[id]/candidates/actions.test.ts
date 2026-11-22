import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const jobWhere = vi.fn().mockResolvedValue([
    { id: "11111111-1111-4111-8111-111111111111", title: "Engineer", status: "open" },
  ]);
  return {
    requireAnyRole: vi.fn(),
    uploadResume: vi.fn(),
    deleteResume: vi.fn(),
    announceWaitingCandidate: vi.fn(),
    logActivity: vi.fn(),
    transaction: vi.fn(),
    candidateInsert: vi.fn(),
    db: {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: jobWhere })) })),
      transaction: (...args: unknown[]) => mocks.transaction(...args),
    },
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/dal", () => ({ requireAnyRole: (...args: unknown[]) => mocks.requireAnyRole(...args) }));
vi.mock("@/lib/storage", () => ({
  uploadResume: (...args: unknown[]) => mocks.uploadResume(...args),
  deleteResume: (...args: unknown[]) => mocks.deleteResume(...args),
}));
vi.mock("@/lib/notify", () => ({
  announceWaitingCandidate: (...args: unknown[]) => mocks.announceWaitingCandidate(...args),
}));
vi.mock("@/lib/activity", () => ({ logActivity: (...args: unknown[]) => mocks.logActivity(...args) }));
vi.mock("@/db", () => ({ db: mocks.db }));

import { createCandidateAction } from "./actions";

function candidateForm() {
  const form = new FormData();
  form.set("jobId", "11111111-1111-4111-8111-111111111111");
  form.set("name", "Asha Rao");
  form.set("email", "asha@example.com");
  form.set("phone", "+91 98765 43210");
  form.set("experienceYears", "5");
  form.set("currentCompany", "Example Ltd");
  form.set("skills", "TypeScript, SQL");
  form.set("resume", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])], "resume.pdf", { type: "application/pdf" }));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAnyRole.mockResolvedValue({ user: { id: "recruiter-1", role: "recruiter" } });
  mocks.uploadResume.mockResolvedValue("job-id/resume.pdf");
  mocks.deleteResume.mockResolvedValue(undefined);
  mocks.announceWaitingCandidate.mockResolvedValue(undefined);
  mocks.candidateInsert.mockReturnValue({
    values: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: "candidate-1" }]) })),
  });
});

describe("createCandidateAction", () => {
  it("writes the candidate and audit entry in the same transaction", async () => {
    const tx = { insert: mocks.candidateInsert };
    mocks.transaction.mockImplementation(async (work: (writer: typeof tx) => Promise<void>) => work(tx));
    mocks.logActivity.mockResolvedValue(undefined);

    await createCandidateAction({}, candidateForm());

    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.logActivity).toHaveBeenCalledWith(
      expect.objectContaining({ action: "candidate.created", entityId: "candidate-1" }),
      tx,
    );
    expect(mocks.deleteResume).not.toHaveBeenCalled();
    expect(mocks.announceWaitingCandidate).toHaveBeenCalledOnce();
  });

  it("cleans up the uploaded resume when the transaction rolls back", async () => {
    const tx = { insert: mocks.candidateInsert };
    mocks.logActivity.mockRejectedValue(new Error("audit insert failed"));
    mocks.transaction.mockImplementation(async (work: (writer: typeof tx) => Promise<void>) => work(tx));

    const result = await createCandidateAction({}, candidateForm());

    expect(result).toEqual({ error: "Could not save the candidate. Try again." });
    expect(mocks.deleteResume).toHaveBeenCalledWith("job-id/resume.pdf");
    expect(mocks.announceWaitingCandidate).not.toHaveBeenCalled();
  });
});
