import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const selectMock = vi.fn();

vi.mock("@/lib/dal", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/storage", () => ({ signedResumeUrl: async (p: string) => `https://storage.example/signed/${p}` }));
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ where: () => selectMock() }) }) },
}));
vi.mock("@/db/schema", () => ({ candidates: { resumePath: "resumePath", id: "id", jobId: "jobId" } }));

import { GET } from "./route";

const JOB = "11111111-1111-4111-8111-111111111111";
const CAND = "22222222-2222-4222-8222-222222222222";
const call = (id = JOB, candidateId = CAND) =>
  GET(new Request("http://localhost/x"), { params: Promise.resolve({ id, candidateId }) });

beforeEach(() => {
  getSessionMock.mockReset();
  selectMock.mockReset();
});

describe("resume link route", () => {
  it("returns 401 when signed out", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("returns 403 for a panelist", async () => {
    getSessionMock.mockResolvedValue({ user: { role: "panelist" } });
    expect((await call()).status).toBe(403);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed ids without touching the database", async () => {
    getSessionMock.mockResolvedValue({ user: { role: "recruiter" } });
    expect((await call("nope", CAND)).status).toBe(404);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the candidate is not on that job", async () => {
    getSessionMock.mockResolvedValue({ user: { role: "admin" } });
    selectMock.mockResolvedValue([]);
    expect((await call()).status).toBe(404);
  });

  it.each(["admin", "recruiter"])("redirects a %s to a signed link", async (role) => {
    getSessionMock.mockResolvedValue({ user: { role } });
    selectMock.mockResolvedValue([{ path: `${JOB}/abc.pdf` }]);
    const res = await call();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(`https://storage.example/signed/${JOB}/abc.pdf`);
  });
});
