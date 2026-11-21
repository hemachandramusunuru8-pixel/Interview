"use client";

import { useActionState, useState } from "react";
import { FileIcon } from "@/components/icons";
import { Button, ButtonLink, Card, CardBody, Field, FormMessage, inputClass } from "@/components/ui";
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

function SectionTitle({ title, text }: { title: string; text: string }) {
  return (
    <div className="md:col-span-2">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500">{text}</p>
    </div>
  );
}

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
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <form action={formAction}>
      <input type="hidden" name="jobId" value={jobId} />
      {candidate && <input type="hidden" name="id" value={candidate.id} />}
      <Card>
        <CardBody className="grid grid-cols-1 gap-5 py-6 md:grid-cols-2">
          <SectionTitle title="Contact" text="How the candidate is reached. Invites go to this email." />
          <Field label="Full name" className="md:col-span-2">
            <input name="name" required maxLength={120} defaultValue={candidate?.name} placeholder="Asha Rao" className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required maxLength={254} defaultValue={candidate?.email} placeholder="asha@example.com" className={inputClass} />
          </Field>
          <Field label="Phone">
            <input name="phone" type="tel" required defaultValue={candidate?.phone} placeholder="+91 98765 43210" className={inputClass} />
          </Field>

          <div className="border-t border-slate-100 md:col-span-2" />
          <SectionTitle title="Background" text="Helps panelists prepare for the interview." />
          <Field label="Experience (years)">
            <input name="experienceYears" type="number" min={0} max={60} required defaultValue={candidate?.experienceYears ?? 0} className={inputClass} />
          </Field>
          <Field label="Current company">
            <input name="currentCompany" maxLength={120} defaultValue={candidate?.currentCompany ?? ""} placeholder="Optional" className={inputClass} />
          </Field>
          <Field label="Skills" hint="Separate skills with commas." className="md:col-span-2">
            <input name="skills" defaultValue={candidate?.skills.join(", ")} placeholder="React, SQL" className={inputClass} />
          </Field>

          <div className="border-t border-slate-100 md:col-span-2" />
          <SectionTitle title="Resume" text="PDF, DOC or DOCX, up to 5 MB. Stored privately." />
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/60 px-6 py-8 text-center transition hover:border-brand-400 hover:bg-brand-50/40 md:col-span-2">
            <FileIcon width={24} height={24} className="text-slate-400" />
            <span className="text-sm font-medium text-slate-700">
              {fileName ?? (candidate ? "Choose a new file to replace the resume" : "Choose a resume file")}
            </span>
            <span className="text-xs text-slate-500">
              {candidate && !fileName ? `Current: ${candidate.resumeFilename}` : "PDF, DOC or DOCX up to 5 MB"}
            </span>
            <input
              name="resume"
              type="file"
              accept=".pdf,.doc,.docx"
              required={!candidate}
              className="sr-only"
              onChange={(e) => setFileName(e.currentTarget.files?.[0]?.name ?? null)}
            />
          </label>

          {state.error && <div className="md:col-span-2"><FormMessage error={state.error} /></div>}
        </CardBody>
        <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <ButtonLink href={`/jobs/${jobId}/candidates`} variant="secondary">Cancel</ButtonLink>
          <Button type="submit" disabled={pending}>{pending ? "Saving..." : submitLabel}</Button>
        </div>
      </Card>
    </form>
  );
}
