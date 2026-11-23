import { beforeEach, describe, expect, it, vi } from "vitest";

// The role guards must run before anything else in every interview action.
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
vi.mock("@/lib/notify", () => ({ notifyUser: vi.fn() }));
vi.mock("@/lib/activity", () => ({ logActivity: vi.fn() }));

import {
  acceptInterviewAction,
  completeInterviewAction,
  declineInterviewAction,
  retryInterviewBookingAction,
} from "@/app/panelist/interviews/actions";
import {
  cancelInterviewAction,
  rescheduleInterviewAction,
  scheduleInterviewAction,
} from "@/app/jobs/[id]/candidates/[candidateId]/interviews/actions";

const denied = new Error("REDIRECT");
const fd = () => new FormData();

beforeEach(() => {
  requireRoleMock.mockReset();
  requireAnyRoleMock.mockReset();
  dbTouched.mockReset();
});

describe("panelist actions", () => {
  it.each([
    ["accept", acceptInterviewAction],
    ["complete", completeInterviewAction],
    ["decline", declineInterviewAction],
    ["retry booking", retryInterviewBookingAction],
  ])("%s requires the panelist role and does nothing else when denied", async (_n, action) => {
    requireRoleMock.mockRejectedValue(denied);
    await expect(action({}, fd())).rejects.toBe(denied);
    expect(requireRoleMock).toHaveBeenCalledWith("panelist");
    expect(dbTouched).not.toHaveBeenCalled();
  });
});

describe("recruiter scheduling actions", () => {
  it.each([
    ["schedule", scheduleInterviewAction],
    ["reschedule", rescheduleInterviewAction],
    ["cancel", cancelInterviewAction],
  ])("%s is limited to admin and recruiter and does nothing else when denied", async (_n, action) => {
    requireAnyRoleMock.mockRejectedValue(denied);
    await expect(action({}, fd())).rejects.toBe(denied);
    expect(requireAnyRoleMock).toHaveBeenCalledWith(["admin", "recruiter"]);
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("rejects a malformed request before touching the database", async () => {
    requireAnyRoleMock.mockResolvedValue({ user: { id: "u1", role: "recruiter" } });
    const res = await scheduleInterviewAction({}, fd());
    expect(res.error).toBeTruthy();
    expect(dbTouched).not.toHaveBeenCalled();
  });

  it("rejects a time in the past", async () => {
    requireAnyRoleMock.mockResolvedValue({ user: { id: "u1", role: "recruiter" } });
    const form = new FormData();
    form.set("candidateId", "11111111-1111-4111-8111-111111111111");
    form.set("jobId", "22222222-2222-4222-8222-222222222222");
    form.set("panelistId", "p1");
    form.set("round", "1");
    form.set("startLocal", "2020-01-01T10:00");
    form.set("timeZone", "Asia/Kolkata");
    form.set("duration", "60");
    const res = await scheduleInterviewAction({}, form);
    expect(res.error).toMatch(/future/i);
    expect(dbTouched).not.toHaveBeenCalled();
  });
});
