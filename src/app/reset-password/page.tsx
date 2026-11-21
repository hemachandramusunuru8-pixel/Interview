"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { CheckCircleIcon } from "@/components/icons";
import { Button, Field, FormMessage, buttonClass, inputClass } from "@/components/ui";
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

  if (!token) {
    return (
      <div className="flex flex-col gap-6">
        <FormMessage error="This link is invalid. Request a new one." />
        <Link href="/forgot-password" className={buttonClass("primary", "md", "w-full")}>Request a new link</Link>
      </div>
    );
  }
  if (done) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-3 rounded-lg bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
          <CheckCircleIcon className="mt-0.5 shrink-0" />
          <p>Your password is saved. You can now sign in.</p>
        </div>
        <Link href="/login" className={buttonClass("primary", "md", "w-full")}>Go to sign in</Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="New password" hint="At least 10 characters.">
        <input name="password" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      <Field label="Confirm password">
        <input name="confirm" type="password" required minLength={10} autoComplete="new-password" className={inputClass} />
      </Field>
      {error && <FormMessage error={error} />}
      <Button type="submit" disabled={busy} className="w-full">
        {busy ? "Saving..." : "Save password"}
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout title="Set your password" subtitle="Choose a password to finish setting up your account.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
