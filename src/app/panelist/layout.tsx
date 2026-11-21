import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/dal";

export default async function PanelistLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("panelist");
  return (
    <AppShell title="Panelist" userName={user.name}>
      {children}
    </AppShell>
  );
}
