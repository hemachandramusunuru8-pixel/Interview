import { describe, expect, it } from "vitest";
import { candidateSchema } from "./candidate";
import { checkResume, MAX_RESUME_BYTES } from "./resume";

const valid = {
  name: "Asha Rao",
  email: "  Asha.Rao@Example.COM ",
  phone: "+91 98765 43210",
  experienceYears: "4",
  currentCompany: "Acme",
  skills: "React, SQL, react",
};

describe("candidateSchema", () => {
  it("accepts a valid candidate, lower-casing the email and cleaning skills", () => {
    const r = candidateSchema.parse(valid);
    expect(r.email).toBe("asha.rao@example.com");
    expect(r.experienceYears).toBe(4);
    expect(r.skills).toEqual(["React", "SQL"]);
  });

  it("turns an empty company into null", () => {
    expect(candidateSchema.parse({ ...valid, currentCompany: "  " }).currentCompany).toBeNull();
  });

  it.each([
    ["empty name", { name: " " }],
    ["bad email", { email: "not-an-email" }],
    ["phone with letters", { phone: "abc123" }],
    ["phone too short", { phone: "12345" }],
    ["negative experience", { experienceYears: "-1" }],
    ["experience over 60", { experienceYears: "61" }],
    ["fractional experience", { experienceYears: "2.5" }],
    ["non-numeric experience", { experienceYears: "many" }],
    ["company over 120 characters", { currentCompany: "x".repeat(121) }],
    ["more than 30 skills", { skills: Array.from({ length: 31 }, (_, i) => `s${i}`).join(",") }],
  ])("rejects %s", (_n, override) => {
    expect(candidateSchema.safeParse({ ...valid, ...override }).success).toBe(false);
  });

  it.each(["+1 (555) 123-4567", "9876543210", "044-2345678"])("accepts phone %s", (phone) => {
    expect(candidateSchema.safeParse({ ...valid, phone }).success).toBe(true);
  });
});

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const ole = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00]);

describe("checkResume", () => {
  it("accepts a real PDF, DOCX and DOC", () => {
    expect(checkResume("cv.pdf", pdf.length, pdf)).toMatchObject({ ok: true, ext: "pdf" });
    expect(checkResume("cv.DOCX", zip.length, zip)).toMatchObject({ ok: true, ext: "docx" });
    expect(checkResume("cv.doc", ole.length, ole)).toMatchObject({ ok: true, ext: "doc" });
  });

  it("rejects a file whose content does not match its extension", () => {
    expect(checkResume("cv.pdf", zip.length, zip).ok).toBe(false);
    expect(checkResume("cv.docx", pdf.length, pdf).ok).toBe(false);
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    expect(checkResume("cv.pdf", exe.length, exe).ok).toBe(false);
  });

  it.each(["cv.txt", "cv.exe", "cv", "cv.pdf.exe", ".pdf.js"])("rejects extension in %s", (name) => {
    expect(checkResume(name, pdf.length, pdf).ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(checkResume("cv.pdf", 0, new Uint8Array()).ok).toBe(false);
  });

  it("rejects a file over 5 MB", () => {
    const big = new Uint8Array(MAX_RESUME_BYTES + 1);
    big.set(pdf);
    expect(checkResume("cv.pdf", big.length, big).ok).toBe(false);
  });

  it("accepts a file of exactly 5 MB", () => {
    const edge = new Uint8Array(MAX_RESUME_BYTES);
    edge.set(pdf);
    expect(checkResume("cv.pdf", edge.length, edge).ok).toBe(true);
  });
});
