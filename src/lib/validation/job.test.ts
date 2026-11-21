import { describe, expect, it } from "vitest";
import { jobSchema, parseSkills } from "./job";

const valid = {
  title: "Backend Engineer",
  department: "Engineering",
  description: "Build APIs.",
  skills: "Node, SQL",
  rounds: "3",
  status: "open",
};

describe("parseSkills", () => {
  it("trims, drops blanks and removes case-insensitive duplicates", () => {
    expect(parseSkills(" React, sql ,, react , SQL,Go ")).toEqual(["React", "sql", "Go"]);
  });
  it("returns an empty list for empty input", () => {
    expect(parseSkills("  ,  ")).toEqual([]);
  });
});

describe("jobSchema", () => {
  it("accepts a valid job and converts rounds and skills", () => {
    const r = jobSchema.parse(valid);
    expect(r.rounds).toBe(3);
    expect(r.skills).toEqual(["Node", "SQL"]);
  });

  it("trims text fields", () => {
    expect(jobSchema.parse({ ...valid, title: "  Dev  " }).title).toBe("Dev");
  });

  it.each([
    ["empty title", { title: "   " }],
    ["empty department", { department: "" }],
    ["empty description", { description: "" }],
    ["title over 150 characters", { title: "x".repeat(151) }],
    ["rounds below 1", { rounds: "0" }],
    ["rounds above 10", { rounds: "11" }],
    ["fractional rounds", { rounds: "2.5" }],
    ["non-numeric rounds", { rounds: "abc" }],
    ["unknown status", { status: "archived" }],
    ["more than 30 skills", { skills: Array.from({ length: 31 }, (_, i) => `s${i}`).join(",") }],
    ["a skill over 50 characters", { skills: "x".repeat(51) }],
  ])("rejects %s", (_name, override) => {
    expect(jobSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each(["open", "on_hold", "closed"])("accepts status %s", (status) => {
    expect(jobSchema.safeParse({ ...valid, status }).success).toBe(true);
  });
});
