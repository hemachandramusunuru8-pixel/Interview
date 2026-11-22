import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.fn();
const requireAnyRoleMock = vi.fn();
const dbTouched = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  requireRole: (...a: unknown[]) => requireRoleMock(...a),
  requireAnyRole: (...a: unknown[]) => requireAnyRoleMock(...a),
}));
vi.mock("@/db", () => ({
  db: new Proxy({}, { get: () => (...a: unknown[]) => dbTouched(...a) }),
}));
vi.mock("@/lib/graph", () => ({
  createInterviewEvent: vi.fn(),
  rescheduleInterviewEvent: vi.fn(),
  cancelInterviewEvent: vi.fn(),
  getInterviewEvent: vi.fn(),
  sendMail: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({
  notifyUser: vi.fn(),
  notifyAllPanelists: vi.fn(),
  announceWaitingCandidate: vi.fn(),
}));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));

import { pickCandidateAction, pickSlotAction } from "@/app/panelist/pipeline/actions";
import { postToPipelineAction } from "@/app/jobs/[id]/candidates/[candidateId]/interviews/actions";

const denied = new Error("REDIRECT");
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  requireRoleMock.mockReset();
  requireAnyRoleMock.mockReset();
  dbTouched.mockReset();
});

describe("pipeline access", () => {
  it.each([
    ["pick a slot", pickSlotAction],
    ["pick a candidate", pickCandidateAction],
  ])("only a panelist can %s, and nothing else runs when denied", async (_n, action) => {
    requireRoleMock.mockRejectedValue(denied);
    await expect(action({}, new FormData())).rejects.toBe(denied);
    expect(requireRoleMock).toHaveBeenCalledWith("panelist");
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("only admin and recruiter can post to the pipeline, and nothing else runs when denied", async () => {
    requireAnyRoleMock.mockRejectedValue(denied);
    await expect(postToPipelineAction({}, new FormData())).rejects.toBe(denied);
    expect(requireAnyRoleMock).toHaveBeenCalledWith(["admin", "recruiter"]);
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("rejects a malformed pick before touching the database", async () => {
    requireRoleMock.mockResolvedValue({ user: { id: "p1", role: "panelist" } });
    expect((await pickSlotAction({}, new FormData())).error).toBeTruthy();
    expect((await pickCandidateAction({}, new FormData())).error).toBeTruthy();
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("rejects a pick for a time in the past before touching the database", async () => {
    requireRoleMock.mockResolvedValue({ user: { id: "p1", role: "panelist" } });
    const form = new FormData();
    form.set("candidateId", A);
    form.set("startLocal", "2020-01-01T10:00");
    form.set("timeZone", "Asia/Kolkata");
    form.set("duration", "60");
    expect((await pickCandidateAction({}, form)).error).toMatch(/future/i);
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("rejects posting a slot in the past before touching the database", async () => {
    requireAnyRoleMock.mockResolvedValue({ user: { id: "r1", role: "recruiter" } });
    const form = new FormData();
    form.set("candidateId", A);
    form.set("jobId", B);
    form.set("startLocal", "2020-01-01T10:00");
    form.set("timeZone", "Asia/Kolkata");
    form.set("duration", "60");
    expect((await postToPipelineAction({}, form)).error).toMatch(/future/i);
    expect(dbTouched).not.toHaveBeenCalled();
  });
});
