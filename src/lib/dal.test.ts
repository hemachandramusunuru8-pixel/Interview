import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("react", () => ({ cache: <T,>(fn: T) => fn }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: (...a: unknown[]) => getSessionMock(...a) } } }));

import { requireAnyRole, requireRole } from "./dal";

function sessionFor(role: string | null, banned = false) {
  getSessionMock.mockResolvedValue({
    user: { id: "u1", name: "Test", role, banned },
    session: { id: "s1" },
  });
}

beforeEach(() => getSessionMock.mockReset());

describe("requireAnyRole (jobs access)", () => {
  it("sends a signed-out visitor to /login", async () => {
    getSessionMock.mockResolvedValue(null);
    await expect(requireAnyRole(["admin", "recruiter"])).rejects.toThrow("REDIRECT:/login");
  });

  it("sends a panelist back to /panelist", async () => {
    sessionFor("panelist");
    await expect(requireAnyRole(["admin", "recruiter"])).rejects.toThrow("REDIRECT:/panelist");
  });

  it.each(["admin", "recruiter"])("lets a %s through", async (role) => {
    sessionFor(role);
    await expect(requireAnyRole(["admin", "recruiter"])).resolves.toMatchObject({ user: { role } });
  });

  it("treats a banned (deactivated) user as signed out", async () => {
    sessionFor("recruiter", true);
    await expect(requireAnyRole(["admin", "recruiter"])).rejects.toThrow("REDIRECT:/login");
  });

  it("treats an unknown role as signed out", async () => {
    sessionFor("user");
    await expect(requireAnyRole(["admin", "recruiter"])).rejects.toThrow("REDIRECT:/login");
  });
});

describe("requireRole (admin area)", () => {
  it("sends a recruiter to /recruiter", async () => {
    sessionFor("recruiter");
    await expect(requireRole("admin")).rejects.toThrow("REDIRECT:/recruiter");
  });
});
