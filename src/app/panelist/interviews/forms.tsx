"use client";

import { useActionState, useState } from "react";
import { Button, FormMessage, inputClass } from "@/components/ui";
import {
  acceptInterviewAction,
  completeInterviewAction,
  declineInterviewAction,
  retryInterviewBookingAction,
  type PanelistActionState,
} from "./actions";

const initial: PanelistActionState = {};

export function AcceptForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(acceptInterviewAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="interviewId" value={interviewId} />
      {!state.ok && (
        <Button type="submit" disabled={pending}>{pending ? "Creating Teams invite..." : "Accept"}</Button>
      )}
      <FormMessage error={state.error} ok={state.ok} />
    </form>
  );
}

export function RetryBookingForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(retryInterviewBookingAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="interviewId" value={interviewId} />
      <Button type="submit" disabled={pending} variant="secondary">
        {pending ? "Retrying Teams invite..." : "Retry Teams invite"}
      </Button>
      <FormMessage error={state.error} ok={state.ok} />
    </form>
  );
}

export function CompleteInterviewForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(completeInterviewAction, initial);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button type="button" variant="secondary" onClick={() => setConfirming(true)}>
        Complete & give feedback
      </Button>
    );
  }

  return (
    <form action={action} className="flex max-w-sm flex-col gap-2 rounded-lg bg-amber-50 p-3 ring-1 ring-amber-200">
      <input type="hidden" name="interviewId" value={interviewId} />
      <p className="text-xs text-amber-900">Confirm only after the Teams interview has finished.</p>
      <FormMessage error={state.error} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setConfirming(false)}>Back</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Opening feedback..." : "Confirm completion"}</Button>
      </div>
    </form>
  );
}

export function DeclineForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(declineInterviewAction, initial);
  const [open, setOpen] = useState(false);

  if (state.ok) return <FormMessage ok={state.ok} />;
  if (!open) {
    return <Button type="button" variant="secondary" onClick={() => setOpen(true)}>Decline</Button>;
  }
  return (
    <form action={action} className="flex w-full flex-col gap-2 sm:w-80">
      <input type="hidden" name="interviewId" value={interviewId} />
      <input name="reason" maxLength={500} placeholder="Reason (optional)" className={inputClass} />
      <FormMessage error={state.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Back</Button>
        <Button type="submit" variant="danger" size="sm" disabled={pending}>Confirm decline</Button>
      </div>
    </form>
  );
}
