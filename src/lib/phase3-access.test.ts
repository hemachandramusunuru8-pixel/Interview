import { beforeEach, describe, expect, it, vi } from "vitest";

const requireRoleMock = vi.fn();
const requireAnyRoleMock = vi.fn();
const dbTouched = vi.fn();
const runDueJobsMock = vi.fn();

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
  sendMail: vi.fn(),
}));
vi.mock("@/lib/notify", () => ({ notifyUser: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));
vi.mock("@/lib/scheduled-jobs", () => ({ runDueJobs: () => runDueJobsMock() }));

import { submitFeedbackAction } from "@/app/panelist/interviews/[id]/feedback/actions";
import { decideOutcomeAction } from "@/app/jobs/[id]/candidates/[candidateId]/interviews/actions";
import { POST } from "@/app/api/cron/tick/route";

const denied = new Error("REDIRECT");

beforeEach(() => {
  requireRoleMock.mockReset();
  requireAnyRoleMock.mockReset();
  dbTouched.mockReset();
  runDueJobsMock.mockReset();
  delete process.env.CRON_SECRET;
});

describe("feedback and decision access", () => {
  it("only a panelist can submit feedback, and nothing else runs when denied", async () => {
    requireRoleMock.mockRejectedValue(denied);
    await expect(submitFeedbackAction({}, new FormData())).rejects.toBe(denied);
    expect(requireRoleMock).toHaveBeenCalledWith("panelist");
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("rejects invalid feedback before touching the database", async () => {
    requireRoleMock.mockResolvedValue({ user: { id: "p1", name: "P", role: "panelist" } });
    const res = await submitFeedbackAction({}, new FormData());
    expect(res.error).toBeTruthy();
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("only admin and recruiter can record a decision, and nothing else runs when denied", async () => {
    requireAnyRoleMock.mockRejectedValue(denied);
    await expect(decideOutcomeAction({}, new FormData())).rejects.toBe(denied);
    expect(requireAnyRoleMock).toHaveBeenCalledWith(["admin", "recruiter"]);
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("rejects an unknown decision before touching the database", async () => {
    requireAnyRoleMock.mockResolvedValue({ user: { id: "r1", role: "recruiter" } });
    const form = new FormData();
    form.set("candidateId", "11111111-1111-4111-8111-111111111111");
    form.set("jobId", "22222222-2222-4222-8222-222222222222");
    form.set("outcome", "hired_instantly");
    const res = await decideOutcomeAction({}, form);
    expect(res.error).toBeTruthy();
    expect(dbTouched).not.toHaveBeenCalled();
  });
});

describe("scheduler endpoint", () => {
  const call = (auth?: string) =>
    POST(new Request("http://localhost/api/cron/tick", { method: "POST", headers: auth ? { authorization: auth } : {} }));

  it("is switched off (503) when no secret is configured", async () => {
    expect((await call("Bearer anything")).status).toBe(503);
    expect(runDueJobsMock).not.toHaveBeenCalled();
  });

  it("rejects a missing or wrong secret", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    expect((await call()).status).toBe(401);
    expect((await call("Bearer wrong")).status).toBe(401);
    expect((await call("s3cret-value")).status).toBe(401);
    expect(runDueJobsMock).not.toHaveBeenCalled();
  });

  it("runs the jobs with the right secret", async () => {
    process.env.CRON_SECRET = "s3cret-value";
    runDueJobsMock.mockResolvedValue({ completed: 1, reminders: 2 });
    const res = await call("Bearer s3cret-value");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ completed: 1, reminders: 2 });
  });
});
