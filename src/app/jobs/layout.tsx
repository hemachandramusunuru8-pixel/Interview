import { AppShell } from "@/components/AppShell";
import { requireAnyRole } from "@/lib/dal";
import { navFor } from "@/lib/nav";

const TITLE = { admin: "Admin", recruiter: "Recruiter" } as const;

// Admin and Recruiter only. A Panelist is redirected to their own area.
export default async function JobsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireAnyRole(["admin", "recruiter"]);
  return (
    <AppShell title={TITLE[user.role as keyof typeof TITLE]} userName={user.name} links={navFor(user.role)}>
      {children}
    </AppShell>
  );
}
