import { describe, expect, it } from "vitest";
import { isRole, ROLES, roles } from "./permissions";

describe("roles", () => {
  it("accepts only the three known roles", () => {
    for (const r of ROLES) expect(isRole(r)).toBe(true);
    for (const bad of ["user", "Admin", "", null, undefined, 3]) expect(isRole(bad)).toBe(false);
  });

  it("defines a permission set for every role", () => {
    expect(Object.keys(roles).sort()).toEqual([...ROLES].sort());
  });

  it("only admin can manage users", () => {
    expect(roles.admin.statements.user).toBeDefined();
    expect(roles.recruiter.statements).not.toHaveProperty("user");
    expect(roles.panelist.statements).not.toHaveProperty("user");
  });

  it("panelists cannot create jobs or candidates", () => {
    expect(roles.panelist.statements).not.toHaveProperty("job");
    expect(roles.panelist.statements).not.toHaveProperty("candidate");
  });
});
