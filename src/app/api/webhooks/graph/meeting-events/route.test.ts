import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/graph-meeting-events", () => ({ queueMeetingNotifications: vi.fn() }));

import { POST } from "./route";

describe("Graph meeting-events webhook", () => {
  it("echoes Graph's decoded validation token as plain text", async () => {
    const response = await POST(new Request(
      "https://app.example.com/api/webhooks/graph/meeting-events?validationToken=opaque%2Btoken",
      { method: "POST" },
    ));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/plain");
    await expect(response.text()).resolves.toBe("opaque+token");
  });
});
