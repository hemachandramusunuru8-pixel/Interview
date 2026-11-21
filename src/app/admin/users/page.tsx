import { asc } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { requireRole } from "@/lib/dal";
import { RoleBadge } from "@/components/status";
import { Avatar, Badge, Card, CardBody, CardHeader, PageHeader, TD, TH, THead, TR, Table } from "@/components/ui";
import { ActiveToggle, CreateUserForm, EditUserForm } from "./forms";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const { user: me } = await requireRole("admin");
  const users = await db.select().from(user).orderBy(asc(user.createdAt));
  const active = users.filter((u) => !u.banned).length;

  return (
    <>
      <PageHeader title="Users" description={`${active} active of ${users.length} people with access.`} />

      <Card className="mb-6">
        <CardHeader title="Invite a user" description="They receive an email with a link to set their password." />
        <CardBody>
          <CreateUserForm />
        </CardBody>
      </Card>

      <Card>
        <Table>
          <THead>
            <tr>
              <TH>Person</TH>
              <TH>Role</TH>
              <TH>Status</TH>
              <TH>Joined</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <tbody>
            {users.map((u) => (
              <TR key={u.id}>
                <TD>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        {u.name}
                        {u.id === me.id && <span className="ml-1.5 text-xs font-normal text-slate-400">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-slate-500">{u.email}</p>
                    </div>
                  </div>
                </TD>
                <TD><RoleBadge role={u.role} /></TD>
                <TD>{u.banned ? <Badge tone="gray" dot>Inactive</Badge> : <Badge tone="green" dot>Active</Badge>}</TD>
                <TD className="whitespace-nowrap text-slate-500">{u.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</TD>
                <TD>
                  <div className="flex items-start justify-end gap-2">
                    <EditUserForm userId={u.id} name={u.name} role={u.role ?? "recruiter"} />
                    <ActiveToggle userId={u.id} active={!u.banned} isSelf={u.id === me.id} />
                  </div>
                </TD>
              </TR>
            ))}
          </tbody>
        </Table>
      </Card>
    </>
  );
}
