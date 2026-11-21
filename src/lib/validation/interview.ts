import { z } from "zod";
import { isValidTimeZone, zonedToUtc } from "@/lib/time";

export const DURATIONS = [30, 45, 60, 90] as const;
export const DEFAULT_DURATION = 60;
export const MIN_LEAD_MINUTES = 5;

export const INTERVIEW_STATUS_LABEL = {
  pending: "Waiting for panelist",
  scheduled: "Scheduled",
  declined: "Declined",
  cancelled: "Cancelled",
  completed: "Completed",
} as const;

export const slotSchema = z
  .object({
    startLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Choose a date and time"),
    timeZone: z.string().refine(isValidTimeZone, "Choose a valid time zone"),
    duration: z.coerce
      .number()
      .refine((n) => (DURATIONS as readonly number[]).includes(n), "Choose a valid duration"),
  })
  .transform((v, ctx) => {
    const startsAt = zonedToUtc(v.startLocal, v.timeZone);
    if (!startsAt) {
      ctx.addIssue({ code: "custom", message: "That date and time is not valid" });
      return z.NEVER;
    }
    return { startsAt, endsAt: new Date(startsAt.getTime() + v.duration * 60_000), timeZone: v.timeZone, duration: v.duration };
  });

/** Same as slotSchema, plus the start must be in the future. */
export function futureSlot(now: Date = new Date()) {
  return slotSchema.refine(
    (s) => s.startsAt.getTime() >= now.getTime() + MIN_LEAD_MINUTES * 60_000,
    "Choose a time in the future",
  );
}

export const scheduleSchema = z.object({
  candidateId: z.string().uuid("Invalid candidate"),
  jobId: z.string().uuid("Invalid job"),
  panelistId: z.string().min(1, "Choose a panelist"),
  round: z.coerce.number().int("Round must be a whole number").min(1, "Round must be at least 1").max(10),
});

export const declineSchema = z.object({
  interviewId: z.string().uuid(),
  reason: z.string().trim().max(500, "Reason is too long (500 characters max)").default(""),
});
