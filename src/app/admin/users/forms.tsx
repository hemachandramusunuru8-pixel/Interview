"use client";

import { useActionState, useState } from "react";
import { Button, Field, FormMessage, inputClass, selectClass } from "@/components/ui";
import { createUserAction, setActiveAction, updateUserAction, type ActionState } from "./actions";

const initial: ActionState = {};

function RoleOptions() {
  return (
    <>
      <option value="recruiter">Recruiter</option>
      <option value="panelist">Panelist</option>
      <option value="admin">Admin</option>
    </>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState(createUserAction, initial);
  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
        <Field label="Full name">
          <input name="name" required placeholder="Priya Sharma" className={inputClass} />
        </Field>
        <Field label="Work email">
          <input name="email" type="email" required placeholder="priya@company.com" className={inputClass} />
        </Field>
        <Field label="Role">
          <select name="role" defaultValue="recruiter" className={selectClass}>
            <RoleOptions />
          </select>
        </Field>
        <Button type="submit" disabled={pending}>{pending ? "Sending invite..." : "Send invite"}</Button>
      </div>
      <FormMessage error={state.error} ok={state.ok} />
    </form>
  );
}

export function EditUserForm(props: { userId: string; name: string; role: string }) {
  const [state, action, pending] = useActionState(updateUserAction, initial);
  // The editor stays open until a save succeeds: it is open while no new result has arrived, or on an error.
  const [openFor, setOpenFor] = useState<ActionState | null>(null);
  const editing = openFor !== null && (openFor === state || Boolean(state.error));
  const setEditing = (on: boolean) => setOpenFor(on ? state : null);

  if (!editing) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        {state.ok && <span className="text-xs text-emerald-600">{state.ok}</span>}
      </div>
    );
  }
  return (
    <form
      action={action}
      className="flex flex-wrap items-center justify-end gap-2"
    >
      <input type="hidden" name="userId" value={props.userId} />
      <input name="name" defaultValue={props.name} required aria-label="Name" className={`${inputClass} w-40`} />
      <select name="role" defaultValue={props.role} aria-label="Role" className={`${selectClass} w-32`}>
        <RoleOptions />
      </select>
      <Button type="submit" size="sm" disabled={pending}>Save</Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
      {state.error && <span className="w-full text-right text-xs text-red-600">{state.error}</span>}
    </form>
  );
}

export function ActiveToggle(props: { userId: string; active: boolean; isSelf: boolean }) {
  const [state, action, pending] = useActionState(setActiveAction, initial);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={props.userId} />
      <input type="hidden" name="active" value={String(!props.active)} />
      <Button
        type="submit"
        size="sm"
        variant={props.active ? "dangerGhost" : "secondary"}
        disabled={pending || props.isSelf}
        title={props.isSelf ? "You cannot deactivate yourself" : undefined}
      >
        {props.active ? "Deactivate" : "Activate"}
      </Button>
      {state.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
