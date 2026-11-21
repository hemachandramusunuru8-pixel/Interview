"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireRole } from "@/lib/dal";
import { db } from "@/db";
import { activityLog } from "@/db/schema";

export type ActionState = { ok?: string; error?: string };

const roleSchema = z.enum(["admin", "recruiter", "panelist"]);
const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  role: roleSchema,
});

async function log(actorId: string, action: string, entityId: string, details?: object) {
  await db.insert(activityLog).values({ actorId, action, entityType: "user", entityId, details });
}

export async function createUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user: actor } = await requireRole("admin");
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, role } = parsed.data;

  try {
    // The user never sees this password. They set their own through the emailed link.
    const created = await auth.api.createUser({
      body: { email, name, role, password: randomBytes(32).toString("base64url") },
      headers: await headers(),
    });
    await log(actor.id, "user.created", created.user.id, { email, role });
    await auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" } });
  } catch (err) {
    console.error("createUserAction failed:", err);
    return { error: "Could not create the user. The email may already be in use." };
  }
  revalidatePath("/admin/users");
  return { ok: `Created ${email}. A link to set their password has been emailed.` };
}

export async function updateUserAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user: actor } = await requireRole("admin");
  const parsed = z
    .object({ userId: z.string().min(1), name: createSchema.shape.name, role: roleSchema })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { userId, name, role } = parsed.data;
  if (userId === actor.id && role !== "admin") {
    return { error: "You cannot remove your own Admin role." };
  }

  try {
    const hdrs = await headers();
    await auth.api.adminUpdateUser({ body: { userId, data: { name } }, headers: hdrs });
    await auth.api.setRole({ body: { userId, role }, headers: hdrs });
    await log(actor.id, "user.updated", userId, { name, role });
  } catch (err) {
    console.error("updateUserAction failed:", err);
    return { error: "Could not update the user." };
  }
  revalidatePath("/admin/users");
  return { ok: "Saved." };
}

export async function setActiveAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user: actor } = await requireRole("admin");
  const parsed = z
    .object({ userId: z.string().min(1), active: z.enum(["true", "false"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const { userId } = parsed.data;
  const active = parsed.data.active === "true";
  if (userId === actor.id && !active) return { error: "You cannot deactivate yourself." };

  try {
    const hdrs = await headers();
    if (active) await auth.api.unbanUser({ body: { userId }, headers: hdrs });
    // Banning blocks sign-in and revokes every existing session straight away.
    else await auth.api.banUser({ body: { userId, banReason: "Deactivated by Admin" }, headers: hdrs });
    await log(actor.id, active ? "user.activated" : "user.deactivated", userId);
  } catch (err) {
    console.error("setActiveAction failed:", err);
    return { error: "Could not change the user's status." };
  }
  revalidatePath("/admin/users");
  return { ok: active ? "User activated." : "User deactivated." };
}
