import { asc } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireRole } from "@/lib/dal";
import { ActiveToggle, CreateUserForm, EditUserForm } from "./forms";

export default async function UsersPage() {
  const { user: me } = await requireRole("admin");
  const users = await db.select().from(user).orderBy(asc(user.createdAt));

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Users</h1>
      <CreateUserForm />
      <table className="w-full text-left text-sm [&_td]:pr-4 [&_th]:pr-4">
        <thead>
          <tr className="border-b">
            <th className="py-2">Email</th>
            <th>Name and role</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-b align-top">
              <td className="py-2">{u.email}</td>
              <td className="py-2">
                <EditUserForm userId={u.id} name={u.name} role={u.role ?? "recruiter"} />
              </td>
              <td className="py-2">
                <div className="mb-1">{u.banned ? "Inactive" : "Active"}</div>
                <ActiveToggle userId={u.id} active={!u.banned} isSelf={u.id === me.id} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
