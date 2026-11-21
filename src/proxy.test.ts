import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function req(path: string, cookie?: string) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : undefined,
  });
}

describe("proxy (optimistic route guard)", () => {
  it.each(["/", "/admin", "/admin/users", "/recruiter", "/panelist"])(
    "redirects %s to /login when there is no session cookie",
    (path) => {
      const res = proxy(req(path));
      expect(res.status).toBe(307);
      expect(new URL(res.headers.get("location")!).pathname).toBe("/login");
    },
  );

  it.each(["/login", "/forgot-password", "/reset-password", "/api/auth/sign-in/email"])(
    "lets %s through without a session",
    (path) => {
      const res = proxy(req(path));
      expect(res.headers.get("location")).toBeNull();
    },
  );

  it("lets a request with a session cookie through (real checks happen in the DAL)", () => {
    const res = proxy(req("/admin", "better-auth.session_token=abc"));
    expect(res.headers.get("location")).toBeNull();
  });
});
