import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/dal";
import { navFor } from "@/lib/nav";

export default async function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("recruiter");
  return (
    <AppShell title="Recruiter" userName={user.name} userId={user.id}
      userEmail={user.email} links={navFor("recruiter")}>
      {children}
    </AppShell>
  );
}
