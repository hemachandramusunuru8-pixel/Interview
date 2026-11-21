"use client";

import { useActionState, useState } from "react";
import { LayersIcon, UsersIcon } from "@/components/icons";
import { SlotFields } from "@/components/SlotFields";
import { Button, Field, FormMessage, cn, selectClass } from "@/components/ui";
import type { Outcome } from "@/lib/emails";
import { OUTCOME_LABEL } from "@/lib/outcomes";
import {
  cancelInterviewAction,
  decideOutcomeAction,
  postToPipelineAction,
  rescheduleInterviewAction,
  scheduleInterviewAction,
  type InterviewFormState,
} from "./actions";

const initial: InterviewFormState = {};

/* ---------- Scheduling: two options as tabs ---------- */

function DirectForm(props: { jobId: string; candidateId: string; round: number; panelists: { id: string; name: string; email: string }[] }) {
  const [state, action, pending] = useActionState(scheduleInterviewAction, initial);
  if (props.panelists.length === 0) {
    return <p className="text-sm text-slate-500">There are no active panelists yet. An Admin can invite them under Users.</p>;
  }
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="jobId" value={props.jobId} />
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <input type="hidden" name="round" value={props.round} />
      <Field label="Panelist">
        <select name="panelistId" required defaultValue="" className={selectClass}>
          <option value="" disabled>Choose a panelist</option>
          {props.panelists.map((p) => (
            <option key={p.id} value={p.id}>{p.name} ({p.email})</option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SlotFields />
      </div>
      <FormMessage error={state.error} ok={state.ok} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Sending..." : "Send request"}</Button>
      </div>
    </form>
  );
}

function PipelineSlotForm(props: { jobId: string; candidateId: string }) {
  const [state, action, pending] = useActionState(postToPipelineAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="jobId" value={props.jobId} />
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SlotFields />
      </div>
      <FormMessage error={state.error} ok={state.ok} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Posting..." : "Post to pipeline"}</Button>
      </div>
    </form>
  );
}

export function SchedulePanel(props: {
  jobId: string;
  candidateId: string;
  round: number;
  panelists: { id: string; name: string; email: string }[];
}) {
  const [tab, setTab] = useState<"direct" | "pipeline">("direct");
  const tabs = [
    { key: "direct" as const, label: "Choose a panelist", icon: UsersIcon, text: "Send a request to one panelist. It is confirmed when they accept." },
    { key: "pipeline" as const, label: "Post to pipeline", icon: LayersIcon, text: "You set the time. Every panelist is notified and the first to pick it takes it." },
  ];
  const current = tabs.find((t) => t.key === tab)!;
  return (
    <div>
      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
              tab === t.key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
            )}
          >
            <t.icon width={16} height={16} />
            {t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate-500">{current.text}</p>
      <div className="mt-4">
        {tab === "direct" ? (
          <DirectForm {...props} />
        ) : (
          <PipelineSlotForm jobId={props.jobId} candidateId={props.candidateId} />
        )}
      </div>
    </div>
  );
}

/* ---------- Live interview actions ---------- */

export function RescheduleForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(rescheduleInterviewAction, initial);
  // Open until a save succeeds: open while no new result has arrived, or on an error.
  const [openFor, setOpenFor] = useState<InterviewFormState | null>(null);
  const open = openFor !== null && (openFor === state || Boolean(state.error));
  const setOpen = (on: boolean) => setOpenFor(on ? state : null);

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>Reschedule</Button>
        {state.ok && <FormMessage ok={state.ok} />}
      </div>
    );
  }
  return (
    <form action={action} className="flex w-full flex-col gap-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
      <input type="hidden" name="interviewId" value={interviewId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SlotFields />
      </div>
      <FormMessage error={state.error} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
        <Button type="submit" size="sm" disabled={pending}>{pending ? "Saving..." : "Save new time"}</Button>
      </div>
    </form>
  );
}

export function CancelForm({ interviewId }: { interviewId: string }) {
  const [state, action, pending] = useActionState(cancelInterviewAction, initial);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Cancel this interview? Everyone invited will be told.")) e.preventDefault();
      }}
      className="flex flex-col gap-2"
    >
      <input type="hidden" name="interviewId" value={interviewId} />
      <Button type="submit" variant="dangerGhost" size="sm" disabled={pending}>
        {pending ? "Cancelling..." : "Cancel interview"}
      </Button>
      <FormMessage error={state.error} ok={state.ok} />
    </form>
  );
}

/* ---------- Decision ---------- */

const OUTCOME_STYLE: Record<Outcome, string> = {
  next_round: "peer-checked:border-brand-500 peer-checked:bg-brand-50 peer-checked:text-brand-700",
  selected: "peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-700",
  rejected: "peer-checked:border-red-500 peer-checked:bg-red-50 peer-checked:text-red-700",
};

export function OutcomeForm(props: { jobId: string; candidateId: string; options: Outcome[] }) {
  const [state, action, pending] = useActionState(decideOutcomeAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="jobId" value={props.jobId} />
      <input type="hidden" name="candidateId" value={props.candidateId} />
      <div className={cn("grid gap-3", props.options.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {props.options.map((o) => (
          <label key={o} className="cursor-pointer">
            <input type="radio" name="outcome" value={o} required className="peer sr-only" />
            <span
              className={cn(
                "flex h-full items-center justify-center rounded-lg border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300",
                OUTCOME_STYLE[o],
              )}
            >
              {OUTCOME_LABEL[o]}
            </span>
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" name="emailCandidate" className="h-4 w-4 rounded border-slate-300 text-brand-600" />
        Email the candidate about this decision
      </label>
      <FormMessage error={state.error} ok={state.ok} />
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Saving..." : "Save decision"}</Button>
      </div>
    </form>
  );
}
