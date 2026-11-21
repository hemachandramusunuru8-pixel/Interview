"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const form = new FormData(e.currentTarget);
    await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    // Same message whether or not the email exists, so accounts cannot be probed.
    setSent(true);
    setBusy(false);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {sent ? (
        <p className="text-sm">If that email has an account, a reset link is on its way.</p>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Email
            <input name="email" type="email" required className="rounded border p-2" />
          </label>
          <button disabled={busy} className="rounded bg-black p-2 text-white disabled:opacity-50">
            Send reset link
          </button>
        </form>
      )}
      <Link href="/login" className="text-sm underline">Back to sign in</Link>
    </main>
  );
}
