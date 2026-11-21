import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/dal";
import { navFor } from "@/lib/nav";

export default async function PanelistLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("panelist");
  return (
    <AppShell title="Panelist" userName={user.name} userId={user.id}
      userEmail={user.email} links={navFor("panelist")}>
      {children}
    </AppShell>
  );
}
