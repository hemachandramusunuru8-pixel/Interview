import { z } from "zod";
import { parseSkills } from "./job";

const MAX_SKILLS = 30;
const MAX_SKILL_LENGTH = 50;

export const CANDIDATE_STAGES = [
  "uploaded",
  "interview_scheduled",
  "interview_done",
  "next_round",
  "selected",
  "rejected",
] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

export const STAGE_LABEL: Record<CandidateStage, string> = {
  uploaded: "Uploaded",
  interview_scheduled: "Interview scheduled",
  interview_done: "Interview done",
  next_round: "Next round",
  selected: "Selected",
  rejected: "Rejected",
};

export const candidateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name is too long (120 characters max)"),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(254, "Email is too long"),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9\s().-]{5,18}[0-9]$/, "Enter a valid phone number (7 to 20 digits, spaces, + - ( ) allowed)"),
  experienceYears: z.coerce
    .number({ message: "Experience must be a number" })
    .int("Experience must be a whole number of years")
    .min(0, "Experience cannot be negative")
    .max(60, "Experience cannot be more than 60 years"),
  currentCompany: z
    .string()
    .trim()
    .max(120, "Company name is too long (120 characters max)")
    .transform((v) => (v === "" ? null : v)),
  skills: z
    .string()
    .default("")
    .transform(parseSkills)
    .refine((s) => s.length <= MAX_SKILLS, `Use at most ${MAX_SKILLS} skills`)
    .refine((s) => s.every((x) => x.length <= MAX_SKILL_LENGTH), `Each skill must be ${MAX_SKILL_LENGTH} characters or fewer`),
});

export type CandidateInput = z.infer<typeof candidateSchema>;
