"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/AuthLayout";
import { Button, Field, FormMessage, inputClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const form = new FormData(e.currentTarget);
    const { error } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setBusy(false);
      setError("Invalid email or password, or your account is inactive.");
      return;
    }
    // "/" sends each role to its own area.
    router.replace("/");
    router.refresh();
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to manage jobs, candidates and interviews.">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="Email">
          <input name="email" type="email" required autoComplete="email" placeholder="you@company.com" className={inputClass} />
        </Field>
        <Field label="Password">
          <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
        </Field>
        <div className="-mt-2 flex justify-end">
          <Link href="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
        </div>
        {error && <FormMessage error={error} />}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Signing in..." : "Sign in"}
        </Button>
      </form>
      <p className="mt-8 text-center text-xs text-slate-500">
        Accounts are created by your administrator. Check your email for an invite link.
      </p>
    </AuthLayout>
  );
}
