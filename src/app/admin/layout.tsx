import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/dal";
import { navFor } from "@/lib/nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireRole("admin");
  return (
    <AppShell title="Admin" userName={user.name} userId={user.id}
      userEmail={user.email} links={navFor("admin")}>
      {children}
    </AppShell>
  );
}
