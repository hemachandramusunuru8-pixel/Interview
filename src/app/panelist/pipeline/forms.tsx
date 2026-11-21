"use client";

import { useActionState, useState } from "react";
import { SlotFields } from "@/components/SlotFields";
import { Button, FormMessage } from "@/components/ui";
import { pickCandidateAction, pickSlotAction, type PipelineState } from "./actions";

const initial: PipelineState = {};

export function PickSlotForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(pickSlotAction, initial);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="interviewId" value={interviewId} />
      {!state.ok && (
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating Teams invite..." : "Pick this interview"}
        </Button>
      )}
      <FormMessage error={state.error} ok={state.ok} />
    </form>
  );
}

export function PickCandidateForm({ candidateId }: { candidateId: string }) {
  const [state, action, pending] = useActionState(pickCandidateAction, initial);
  const [open, setOpen] = useState(false);

  if (state.ok) return <FormMessage ok={state.ok} />;
  if (!open) {
    return (
      <Button type="button" variant="secondary" className="w-full" onClick={() => setOpen(true)}>
        Pick and choose a time
      </Button>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
      <input type="hidden" name="candidateId" value={candidateId} />
      <SlotFields />
      <FormMessage error={state.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Booking..." : "Book interview"}</Button>
      </div>
    </form>
  );
}
