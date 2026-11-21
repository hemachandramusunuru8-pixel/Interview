"use client";

import { useActionState } from "react";
import { createUserAction, setActiveAction, updateUserAction, type ActionState } from "./actions";

const initial: ActionState = {};

function Message({ state }: { state: ActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-red-600">{state.error}</p>;
  if (state.ok) return <p role="status" className="text-sm text-green-700">{state.ok}</p>;
  return null;
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded border p-4">
      <label className="flex flex-col gap-1 text-sm">Name
        <input name="name" required className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Email
        <input name="email" type="email" required className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">Role
        <select name="role" defaultValue="recruiter" className="rounded border p-2">
          <option value="recruiter">Recruiter</option>
          <option value="panelist">Panelist</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
        {pending ? "Creating..." : "Create user"}
      </button>
      <div className="w-full"><Message state={state} /></div>
    </form>
  );
}

export function EditUserForm(props: { userId: string; name: string; role: string }) {
  const [state, action, pending] = useActionState(updateUserAction, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={props.userId} />
      <input name="name" defaultValue={props.name} required className="rounded border p-1 text-sm" />
      <select name="role" defaultValue={props.role} className="rounded border p-1 text-sm">
        <option value="recruiter">Recruiter</option>
        <option value="panelist">Panelist</option>
        <option value="admin">Admin</option>
      </select>
      <button disabled={pending} className="rounded border px-2 py-1 text-sm">Save</button>
      <Message state={state} />
    </form>
  );
}

export function ActiveToggle(props: { userId: string; active: boolean; isSelf: boolean }) {
  const [state, action, pending] = useActionState(setActiveAction, initial);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="userId" value={props.userId} />
      <input type="hidden" name="active" value={String(!props.active)} />
      <button disabled={pending || props.isSelf} className="rounded border px-2 py-1 text-sm disabled:opacity-40">
        {props.active ? "Deactivate" : "Activate"}
      </button>
      <Message state={state} />
    </form>
  );
}
