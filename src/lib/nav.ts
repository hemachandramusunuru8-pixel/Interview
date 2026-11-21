import type { IconName } from "@/components/icons";
import type { Role } from "@/lib/permissions";

export type NavLink = { href: string; label: string; icon: IconName };

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  recruiter: "Recruiter",
  panelist: "Panelist",
};

/** Navigation links per role. Panelists get no Jobs link: they cannot open that area. */
export function navFor(role: Role): NavLink[] {
  switch (role) {
    case "admin":
      return [
        { href: "/admin", label: "Dashboard", icon: "home" },
        { href: "/jobs", label: "Jobs", icon: "briefcase" },
        { href: "/admin/users", label: "Users", icon: "users" },
        { href: "/admin/activity", label: "Activity", icon: "activity" },
      ];
    case "recruiter":
      return [
        { href: "/recruiter", label: "Dashboard", icon: "home" },
        { href: "/jobs", label: "Jobs", icon: "briefcase" },
      ];
    case "panelist":
      return [
        { href: "/panelist", label: "Dashboard", icon: "home" },
        { href: "/panelist/pipeline", label: "Pipeline", icon: "layers" },
        { href: "/panelist/interviews", label: "My interviews", icon: "calendar" },
      ];
  }
}
