"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

function ResetForm() {
  const token = useSearchParams().get("token");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password !== String(form.get("confirm"))) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    const { error } = await authClient.resetPassword({ newPassword: password, token: token ?? "" });
    setBusy(false);
    if (error) setError("This link is invalid or has expired. Request a new one.");
    else setDone(true);
  }

  if (!token) return <p className="text-sm">This link is invalid. Request a new one.</p>;
  if (done) return <p className="text-sm">Password saved. You can now sign in.</p>;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        New password (at least 10 characters)
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className="rounded border p-2" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm password
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className="rounded border p-2" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button disabled={busy} className="rounded bg-black p-2 text-white disabled:opacity-50">Save password</button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Set your password</h1>
      <Suspense>
        <ResetForm />
      </Suspense>
      <Link href="/login" className="text-sm underline">Go to sign in</Link>
    </main>
  );
}
