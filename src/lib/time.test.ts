import { describe, expect, it } from "vitest";
import { formatInZone, isValidTimeZone, zonedToUtc } from "./time";
import { futureSlot, slotSchema } from "./validation/interview";

describe("zonedToUtc", () => {
  it("converts India time (UTC+5:30, no daylight saving)", () => {
    expect(zonedToUtc("2026-12-01T10:30", "Asia/Kolkata")?.toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  it("handles US winter and summer offsets", () => {
    expect(zonedToUtc("2026-01-15T09:00", "America/New_York")?.toISOString()).toBe("2026-01-15T14:00:00.000Z");
    expect(zonedToUtc("2026-07-15T09:00", "America/New_York")?.toISOString()).toBe("2026-07-15T13:00:00.000Z");
  });

  it("returns the same time for UTC", () => {
    expect(zonedToUtc("2026-05-05T00:00", "UTC")?.toISOString()).toBe("2026-05-05T00:00:00.000Z");
  });

  it("rounds trips through formatting in the same zone", () => {
    const d = zonedToUtc("2026-12-01T10:30", "Asia/Kolkata")!;
    expect(formatInZone(d, "Asia/Kolkata")).toContain("10:30 am");
  });

  it.each([
    ["2026-02-31T10:00", "UTC"],
    ["2026-13-01T10:00", "UTC"],
    ["2026-12-01T25:00", "UTC"],
    ["2026-12-01 10:00", "UTC"],
    ["", "UTC"],
    ["2026-12-01T10:00", "Mars/Olympus"],
  ])("returns null for %s in %s", (local, tz) => {
    expect(zonedToUtc(local, tz)).toBeNull();
  });
});

describe("isValidTimeZone", () => {
  it("accepts real zones and rejects made-up ones", () => {
    expect(isValidTimeZone("Europe/London")).toBe(true);
    expect(isValidTimeZone("Nowhere/City")).toBe(false);
  });
});

describe("slot validation", () => {
  const base = { startLocal: "2030-06-01T10:00", timeZone: "Asia/Kolkata", duration: "60" };

  it("builds start and end in UTC", () => {
    const s = slotSchema.parse(base);
    expect(s.startsAt.toISOString()).toBe("2030-06-01T04:30:00.000Z");
    expect(s.endsAt.toISOString()).toBe("2030-06-01T05:30:00.000Z");
  });

  it.each([
    ["bad duration", { duration: "75" }],
    ["bad zone", { timeZone: "Mars/Olympus" }],
    ["bad date", { startLocal: "2030-02-30T10:00" }],
    ["missing date", { startLocal: "" }],
  ])("rejects %s", (_n, override) => {
    expect(slotSchema.safeParse({ ...base, ...override }).success).toBe(false);
  });

  it("rejects a time in the past and accepts one in the future", () => {
    const now = new Date("2030-06-01T04:00:00.000Z");
    expect(futureSlot(now).safeParse({ ...base, startLocal: "2030-06-01T09:00" }).success).toBe(false); // 03:30Z, past
    expect(futureSlot(now).safeParse(base).success).toBe(true); // 04:30Z
  });

  it("requires a few minutes of lead time", () => {
    const now = new Date("2030-06-01T04:28:00.000Z");
    expect(futureSlot(now).safeParse(base).success).toBe(false); // starts in 2 minutes
  });
});
