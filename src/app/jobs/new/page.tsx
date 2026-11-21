import { requireAnyRole } from "@/lib/dal";
import { createJobAction } from "../actions";
import { JobForm } from "../JobForm";

export default async function NewJobPage() {
  await requireAnyRole(["admin", "recruiter"]);
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">New job</h1>
      <JobForm action={createJobAction} submitLabel="Create job" />
    </section>
  );
}
