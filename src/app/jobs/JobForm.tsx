"use client";

import { useActionState } from "react";
import { Button, ButtonLink, Card, CardBody, Field, FormMessage, inputClass, selectClass, textareaClass } from "@/components/ui";
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
    <form action={formAction}>
      {job && <input type="hidden" name="id" value={job.id} />}
      <Card>
        <CardBody className="grid grid-cols-1 gap-5 py-6 md:grid-cols-2">
          <Field label="Job title" className="md:col-span-2">
            <input name="title" required maxLength={150} defaultValue={job?.title} placeholder="Senior Backend Engineer" className={inputClass} />
          </Field>
          <Field label="Department">
            <input name="department" required maxLength={100} defaultValue={job?.department} placeholder="Engineering" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Interview rounds">
              <input name="rounds" type="number" min={1} max={10} required defaultValue={job?.rounds ?? 2} className={inputClass} />
            </Field>
            <Field label="Status">
              <select name="status" defaultValue={job?.status ?? "open"} className={selectClass}>
                {JOB_STATUSES.map((s) => (
                  <option key={s} value={s}>{JOB_STATUS_LABEL[s]}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Description" className="md:col-span-2">
            <textarea name="description" required rows={7} maxLength={5000} defaultValue={job?.description} placeholder="What the role involves, and what great looks like." className={textareaClass} />
          </Field>
          <Field label="Skills" hint="Separate skills with commas, for example: React, SQL, Communication." className="md:col-span-2">
            <input name="skills" defaultValue={job?.skills.join(", ")} placeholder="React, SQL, Communication" className={inputClass} />
          </Field>
          {state.error && <div className="md:col-span-2"><FormMessage error={state.error} /></div>}
        </CardBody>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <ButtonLink href="/jobs" variant="secondary">Cancel</ButtonLink>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : submitLabel}</Button>
        </div>
      </Card>
    </form>
  );
}
