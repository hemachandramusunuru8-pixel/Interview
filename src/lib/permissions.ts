import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc } from "better-auth/plugins/admin/access";

export const ROLES = ["admin", "recruiter", "panelist"] as const;
export type Role = (typeof ROLES)[number];

// What each role may do. Admin also gets Better Auth's built-in user management.
const statement = {
  ...defaultStatements,
  job: ["create", "read", "update"],
  candidate: ["create", "read", "update"],
  interview: ["create", "read", "update", "respond"],
  feedback: ["create", "read"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  admin: ac.newRole({
    ...adminAc.statements,
    job: ["create", "read", "update"],
    candidate: ["create", "read", "update"],
    interview: ["create", "read", "update"],
    feedback: ["read"],
  }),
  recruiter: ac.newRole({
    job: ["create", "read", "update"],
    candidate: ["create", "read", "update"],
    interview: ["create", "read", "update"],
    feedback: ["read"],
  }),
  panelist: ac.newRole({
    interview: ["read", "respond"],
    feedback: ["create", "read"],
  }),
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
