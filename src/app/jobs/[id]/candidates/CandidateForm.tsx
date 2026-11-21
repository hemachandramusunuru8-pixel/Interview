"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MAX_RESUME_BYTES } from "@/lib/validation/resume";
import type { CandidateFormState } from "./actions";

type Props = {
  action: (prev: CandidateFormState, formData: FormData) => Promise<CandidateFormState>;
  jobId: string;
  submitLabel: string;
  candidate?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    experienceYears: number;
    currentCompany: string | null;
    skills: string[];
    resumeFilename: string;
  };
};

export function CandidateForm({ action, jobId, submitLabel, candidate }: Props) {
  // Check the file size here first: a request over the server limit is rejected by Next.js
  // with a raw error page before our server-side checks can run.
  const [state, formAction, pending] = useActionState(
    async (prev: CandidateFormState, formData: FormData): Promise<CandidateFormState> => {
      const file = formData.get("resume");
      if (file instanceof File && file.size > MAX_RESUME_BYTES) {
        return { error: "The resume is larger than 5 MB. Upload a smaller file." };
      }
      return action(prev, formData);
    },
    {},
  );
  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="jobId" value={jobId} />
      {candidate && <input type="hidden" name="id" value={candidate.id} />}
      <label className="flex flex-col gap-1 text-sm">Full name
        <input name="name" required maxLength={120} defaultValue={candidate?.name} className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Email
        <input name="email" type="email" required maxLength={254} defaultValue={candidate?.email} className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Phone
        <input name="phone" type="tel" required defaultValue={candidate?.phone} className="rounded border p-2" />
      </label>
      <div className="flex gap-4">
        <label className="flex flex-col gap-1 text-sm">Experience (years)
          <input name="experienceYears" type="number" min={0} max={60} required defaultValue={candidate?.experienceYears ?? 0} className="w-32 rounded border p-2" />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">Current company
          <input name="currentCompany" maxLength={120} defaultValue={candidate?.currentCompany ?? ""} className="rounded border p-2" />
        </label>
      </div>
      <label className="flex flex-col gap-1 text-sm">Skills (comma-separated)
        <input name="skills" defaultValue={candidate?.skills.join(", ")} placeholder="React, SQL" className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Resume (PDF, DOC or DOCX, up to 5 MB){candidate && " - leave empty to keep the current file"}
        <input
          name="resume"
          type="file"
          accept=".pdf,.doc,.docx"
          required={!candidate}
          className="rounded border p-2"
        />
        {candidate && <span className="text-xs opacity-70">Current: {candidate.resumeFilename}</span>}
      </label>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <div className="flex gap-3">
        <button disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
          {pending ? "Saving..." : submitLabel}
        </button>
        <Link href={`/jobs/${jobId}/candidates`} className="rounded border px-4 py-2">Cancel</Link>
      </div>
    </form>
  );
}
