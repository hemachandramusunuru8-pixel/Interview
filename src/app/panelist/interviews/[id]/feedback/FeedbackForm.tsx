"use client";

import { useActionState, useState } from "react";
import { Button, ButtonLink, Card, CardBody, Field, FormMessage, cn, textareaClass } from "@/components/ui";
import { submitFeedbackAction } from "./actions";

const RATING_TEXT = ["", "Poor", "Below bar", "Meets bar", "Strong", "Exceptional"];

const RECS = [
  { value: "move_forward", label: "Move forward", style: "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700" },
  { value: "hold", label: "Hold", style: "peer-checked:border-amber-500 peer-checked:bg-amber-50 peer-checked:text-amber-800" },
  { value: "reject", label: "Reject", style: "peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700" },
];

export function FeedbackForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(submitFeedbackAction, {});
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || rating;

  return (
    <form action={action}>
      <input type="hidden" name="interviewId" value={interviewId} />
      <input type="hidden" name="rating" value={rating || ""} />
      <Card>
        <CardBody className="flex flex-col gap-6 py-6">
          <div>
            <p className="text-sm font-medium text-slate-700">Overall rating</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex" onMouseLeave={() => setHover(0)}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-label={`${n} out of 5`}
                    onMouseEnter={() => setHover(n)}
                    onClick={() => setRating(n)}
                    className={cn("px-0.5 text-3xl leading-none transition", n <= shown ? "text-amber-400" : "text-slate-200 hover:text-slate-300")}
                  >
                    ★
                  </button>
                ))}
              </div>
              <span className="text-sm text-slate-500">{shown ? `${shown}/5 · ${RATING_TEXT[shown]}` : "Choose a rating"}</span>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700">Recommendation</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-3">
              {RECS.map((r) => (
                <label key={r.value} className="cursor-pointer">
                  <input type="radio" name="recommendation" value={r.value} required className="peer sr-only" />
                  <span className={cn("flex items-center justify-center rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300", r.style)}>
                    {r.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <Field label="Comments" hint="Strengths, concerns and evidence from the interview. Up to 3000 characters.">
            <textarea name="comments" required rows={7} maxLength={3000} className={textareaClass} />
          </Field>

          <FormMessage error={state.error} />
        </CardBody>
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Feedback can be submitted only once.</p>
          <div className="flex gap-3">
            <ButtonLink href="/panelist/interviews" variant="secondary">Cancel</ButtonLink>
            <Button type="submit" disabled={pending || rating === 0}>{pending ? "Submitting..." : "Submit feedback"}</Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
