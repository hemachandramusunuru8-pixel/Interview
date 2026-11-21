"use client";

import Link from "next/link";
import { useActionState } from "react";
import { JOB_STATUSES, JOB_STATUS_LABEL, type JobStatus } from "@/lib/validation/job";
import type { JobFormState } from "./actions";

type Props = {
  action: (prev: JobFormState, formData: FormData) => Promise<JobFormState>;
  submitLabel: string;
  job?: {
    id: string;
    title: string;
    department: string;
    description: string;
    skills: string[];
    rounds: number;
    status: JobStatus;
  };
};

export function JobForm({ action, submitLabel, job }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      {job && <input type="hidden" name="id" value={job.id} />}
      <label className="flex flex-col gap-1 text-sm">Title
        <input name="title" required maxLength={150} defaultValue={job?.title} className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Department
        <input name="department" required maxLength={100} defaultValue={job?.department} className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Description
        <textarea name="description" required rows={6} maxLength={5000} defaultValue={job?.description} className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Skills (comma-separated)
        <input name="skills" defaultValue={job?.skills.join(", ")} placeholder="React, SQL, Communication" className="rounded border p-2" />
      </label>
      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm">Number of rounds
          <input name="rounds" type="number" min={1} max={10} required defaultValue={job?.rounds ?? 2} className="w-28 rounded border p-2" />
        </label>
        <label className="flex flex-col gap-1 text-sm">Status
          <select name="status" defaultValue={job?.status ?? "open"} className="rounded border p-2">
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </label>
      </div>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {pending ? "Saving..." : submitLabel}
        </button>
        <Link href="/jobs" className="rounded border px-4 py-2">Cancel</Link>
      </div>
    </form>
  );
}
