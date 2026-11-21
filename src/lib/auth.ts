import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { appBaseUrl } from "@/lib/base-url";
import { ac, roles } from "@/lib/permissions";
import { sendMail } from "@/lib/graph";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export const auth = betterAuth({
  baseURL: appBaseUrl(),
  secret: process.env.AUTH_SECRET,
  advanced: {
    // Rate limiting is per visitor, so it needs the real client address. Netlify passes it in
    // x-nf-client-connection-ip; without this every visitor would share one sign-in limit.
    ipAddress: { ipAddressHeaders: ["x-nf-client-connection-ip", "x-forwarded-for"] },
  },
  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    // No public sign-up: only an Admin creates users.
    disableSignUp: true,
    minPasswordLength: 10,
    // Invite links double as "set your password" links, so keep them valid for 3 days.
    resetPasswordTokenExpiresIn: 60 * 60 * 24 * 3,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited, as the Better Auth docs advise, to avoid leaking timing information.
      void sendMail({
        to: user.email,
        subject: "Set your Interview Platform password",
        html:
          `<p>Hello ${escapeHtml(user.name)},</p>` +
          `<p>Use the link below to set your password and sign in to the Interview Platform. ` +
          `The link expires in 3 days.</p>` +
          `<p><a href="${escapeHtml(url)}">Set your password</a></p>` +
          `<p>If you did not expect this email, you can ignore it.</p>`,
      }).catch((err) => console.error("Failed to send password email:", err));
    },
  },

  user: {
    additionalFields: {
      // Panelist skills, stored as JSON text so the same column works for every role.
      skills: { type: "string", required: false, input: false },
    },
  },

  rateLimit: { enabled: true, storage: "database" },

  plugins: [
    admin({ ac, roles, defaultRole: "recruiter", adminRoles: ["admin"] }),
    nextCookies(), // keep last
  ],
});
