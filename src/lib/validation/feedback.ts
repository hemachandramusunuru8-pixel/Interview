import { z } from "zod";

export const RECOMMENDATIONS = ["move_forward", "hold", "reject"] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

export const feedbackSchema = z.object({
  interviewId: z.string().uuid("Invalid interview"),
  rating: z.coerce
    .number({ message: "Choose a rating" })
    .int("Choose a rating from 1 to 5")
    .min(1, "Choose a rating from 1 to 5")
    .max(5, "Choose a rating from 1 to 5"),
  recommendation: z.enum(RECOMMENDATIONS, { message: "Choose a recommendation" }),
  comments: z
    .string()
    .trim()
    .min(1, "Comments are required")
    .max(3000, "Comments are too long (3000 characters max)"),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
