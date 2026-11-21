import { AppShell } from "@/components/AppShell";
import { requireUser } from "@/lib/dal";
import { navFor } from "@/lib/nav";

const TITLE = { admin: "Admin", recruiter: "Recruiter", panelist: "Panelist" } as const;

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <AppShell title={TITLE[user.role]} userName={user.name} userId={user.id}
      userEmail={user.email} links={navFor(user.role)}>
      {children}
    </AppShell>
  );
}
