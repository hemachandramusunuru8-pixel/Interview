import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isRole, type Role } from "@/lib/permissions";

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  recruiter: "/recruiter",
  panelist: "/panelist",
};

/** Validated session from the database, memoised per request. Null if signed out. */
export const getSession = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const role = session.user.role;
  // A user without a known role, or one that is banned, gets no access.
  if (!isRole(role) || session.user.banned) return null;
  return { user: { ...session.user, role }, session: session.session };
});

/** Redirects to /login unless signed in. */
export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Redirects to the user's own area unless they hold one of the allowed roles. */
export async function requireAnyRole(allowed: readonly Role[]) {
  const s = await requireUser();
  if (!allowed.includes(s.user.role)) redirect(ROLE_HOME[s.user.role]);
  return s;
}

/** Redirects to the user's own area unless they have the required role. */
export async function requireRole(role: Role) {
  const s = await requireUser();
  if (s.user.role !== role) redirect(ROLE_HOME[s.user.role]);
  return s;
}
