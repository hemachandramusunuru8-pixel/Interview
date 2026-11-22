import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();
const selectMock = vi.fn();
const fetchContentMock = vi.fn();
const logMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/dal", () => ({ getSession: () => getSessionMock() }));
vi.mock("@/lib/graph", () => ({ fetchRecordingContent: (...a: unknown[]) => fetchContentMock(...a) }));
vi.mock("@/lib/activity", () => ({ logActivity: (...a: unknown[]) => logMock(...a) }));
vi.mock("@/db", () => ({
  db: { select: () => ({ from: () => ({ innerJoin: () => ({ where: () => selectMock() }) }) }) },
}));
vi.mock("@/db/schema", () => ({
  interviewRecordings: { id: "id", meetingId: "meetingId", graphRecordingId: "graphRecordingId", interviewId: "interviewId" },
  interviews: { id: "id", candidateId: "candidateId", jobId: "jobId" },
}));

import { GET } from "./route";

const JOB = "11111111-1111-4111-8111-111111111111";
const CAND = "22222222-2222-4222-8222-222222222222";
const REC = "33333333-3333-4333-8333-333333333333";
const call = (headers: Record<string, string> = {}, recordingId = REC) =>
  GET(new Request("http://localhost/x", { headers }), { params: Promise.resolve({ id: JOB, candidateId: CAND, recordingId }) });

beforeEach(() => {
  getSessionMock.mockReset();
  selectMock.mockReset();
  fetchContentMock.mockReset();
  logMock.mockClear();
});

describe("recording watch route", () => {
  it("returns 401 when signed out", async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it("returns 403 for a panelist and never contacts Microsoft", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "p", role: "panelist" } });
    expect((await call()).status).toBe(403);
    expect(fetchContentMock).not.toHaveBeenCalled();
  });

  it("returns 404 for malformed ids", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "r", role: "recruiter" } });
    expect((await call({}, "nope")).status).toBe(404);
    expect(selectMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the recording is not on this candidate's interviews", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "a", role: "admin" } });
    selectMock.mockResolvedValue([]);
    expect((await call()).status).toBe(404);
    expect(fetchContentMock).not.toHaveBeenCalled();
  });

  it("sends the browser to Microsoft's own link when Graph redirects", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "r", role: "recruiter" } });
    selectMock.mockResolvedValue([{ meetingId: "m1", graphRecordingId: "g1", interviewId: "i1" }]);
    fetchContentMock.mockResolvedValue(new Response(null, { status: 302, headers: { location: "https://video.example/abc" } }));
    const res = await call();
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://video.example/abc");
    expect(fetchContentMock).toHaveBeenCalledWith("m1", "g1", null);
    expect(logMock).toHaveBeenCalledTimes(1);
  });

  it("streams the video through, passing the range and the video headers", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "a", role: "admin" } });
    selectMock.mockResolvedValue([{ meetingId: "m1", graphRecordingId: "g1", interviewId: "i1" }]);
    fetchContentMock.mockResolvedValue(
      new Response("abc", { status: 206, headers: { "content-type": "video/mp4", "content-range": "bytes 100-102/9000", "accept-ranges": "bytes" } }),
    );
    const res = await call({ range: "bytes=100-102" });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe("bytes 100-102/9000");
    expect(res.headers.get("content-type")).toBe("video/mp4");
    expect(fetchContentMock).toHaveBeenCalledWith("m1", "g1", "bytes=100-102");
    expect(logMock).not.toHaveBeenCalled(); // a later chunk is not a new view
  });

  it("explains when Microsoft no longer has the recording", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "a", role: "admin" } });
    selectMock.mockResolvedValue([{ meetingId: "m1", graphRecordingId: "g1", interviewId: "i1" }]);
    fetchContentMock.mockResolvedValue(new Response("gone", { status: 404 }));
    const res = await call();
    expect(res.status).toBe(404);
    expect(await res.text()).toMatch(/no longer available/);
  });

  it("returns 502 when Microsoft cannot be reached", async () => {
    getSessionMock.mockResolvedValue({ user: { id: "a", role: "admin" } });
    selectMock.mockResolvedValue([{ meetingId: "m1", graphRecordingId: "g1", interviewId: "i1" }]);
    fetchContentMock.mockRejectedValue(new Error("network"));
    expect((await call()).status).toBe(502);
  });
});
