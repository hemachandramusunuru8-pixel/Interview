import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

// Optimistic check only: it looks for a session cookie. Real validation and role checks
// happen on the server in src/lib/dal.ts, next to the data.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  // /api/cron/* is called by a scheduler with a shared secret, not a browser session.
  if (isPublic || pathname.startsWith("/api/auth") || pathname.startsWith("/api/cron") || pathname === "/api/health") return NextResponse.next();

  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
