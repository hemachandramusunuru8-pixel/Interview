"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthLayout } from "@/components/AuthLayout";
import { MailIcon } from "@/components/icons";
import { Button, Field, buttonClass, inputClass } from "@/components/ui";
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
    <AuthLayout
      title={sent ? "Check your email" : "Reset your password"}
      subtitle={sent ? undefined : "Enter your work email and we will send you a reset link."}
    >
      {sent ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-3 rounded-lg bg-brand-50 p-4 text-sm text-brand-900 ring-1 ring-inset ring-brand-100">
            <MailIcon className="mt-0.5 shrink-0 text-brand-600" />
            <p>If that email has an account, a reset link is on its way. The link expires in 3 days.</p>
          </div>
          <Link href="/login" className={buttonClass("secondary", "md", "w-full")}>Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className={inputClass} />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Sending..." : "Send reset link"}
          </Button>
          <Link href="/login" className="text-center text-sm font-medium text-slate-600 hover:text-slate-900">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  );
}
