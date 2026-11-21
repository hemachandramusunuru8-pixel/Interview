import { z } from "zod";

export const JOB_STATUSES = ["open", "on_hold", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_STATUS_LABEL: Record<JobStatus, string> = {
  open: "Open",
  on_hold: "On hold",
  closed: "Closed",
};

const MAX_SKILLS = 30;
const MAX_SKILL_LENGTH = 50;

/** "React, sql,  React" -> ["React", "sql"]. Trims, drops blanks, removes case-insensitive duplicates. */
export function parseSkills(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(",")) {
    const skill = raw.trim();
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    out.push(skill);
  }
  return out;
}

export const jobSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150, "Title is too long (150 characters max)"),
  department: z.string().trim().min(1, "Department is required").max(100, "Department is too long (100 characters max)"),
  description: z.string().trim().min(1, "Description is required").max(5000, "Description is too long (5000 characters max)"),
  skills: z
    .string()
    .default("")
    .transform(parseSkills)
    .refine((s) => s.length <= MAX_SKILLS, `Use at most ${MAX_SKILLS} skills`)
    .refine((s) => s.every((x) => x.length <= MAX_SKILL_LENGTH), `Each skill must be ${MAX_SKILL_LENGTH} characters or fewer`),
  rounds: z.coerce
    .number({ message: "Rounds must be a number" })
    .int("Rounds must be a whole number")
    .min(1, "At least 1 round")
    .max(10, "At most 10 rounds"),
  status: z.enum(JOB_STATUSES, { message: "Choose a valid status" }),
});

export type JobInput = z.infer<typeof jobSchema>;
