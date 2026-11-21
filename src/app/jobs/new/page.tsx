import { PageHeader } from "@/components/ui";
import { requireAnyRole } from "@/lib/dal";
import { createJobAction } from "../actions";
import { JobForm } from "../JobForm";

export const metadata = { title: "New job" };

export default async function NewJobPage() {
  await requireAnyRole(["admin", "recruiter"]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="New job"
        description="Candidates you add to this job go straight into the pipeline for panelists."
        back={{ href: "/jobs", label: "Jobs" }}
      />
      <JobForm action={createJobAction} submitLabel="Create job" />
    </div>
  );
}
