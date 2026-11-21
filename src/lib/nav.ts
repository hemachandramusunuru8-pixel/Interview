import type { Role } from "@/lib/permissions";

export type NavLink = { href: string; label: string };

/** Navigation links per role. Panelists get no Jobs link: they cannot open that area. */
export function navFor(role: Role): NavLink[] {
  switch (role) {
    case "admin":
      return [
        { href: "/admin", label: "Overview" },
        { href: "/jobs", label: "Jobs" },
        { href: "/admin/users", label: "Users" },
      ];
    case "recruiter":
      return [
        { href: "/recruiter", label: "Overview" },
        { href: "/jobs", label: "Jobs" },
      ];
    case "panelist":
      return [];
  }
}
