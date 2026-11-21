import { NotificationsLink } from "./NotificationsLink";
import { ShellChrome } from "./ShellChrome";
import type { NavLink } from "@/lib/nav";

type Props = {
  title: string; // role label, e.g. "Admin"
  userName: string;
  userEmail?: string;
  userId: string;
  links?: NavLink[];
  children: React.ReactNode;
};

export function AppShell({ title, userName, userEmail = "", userId, links = [], children }: Props) {
  return (
    <ShellChrome
      links={links}
      roleLabel={title}
      userName={userName}
      userEmail={userEmail}
      bell={<NotificationsLink userId={userId} />}
    >
      {children}
    </ShellChrome>
  );
}
