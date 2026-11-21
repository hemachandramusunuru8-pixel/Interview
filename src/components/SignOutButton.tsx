"use client";

import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  return (
    <button
      className="rounded border px-3 py-1 text-sm"
      onClick={async () => {
        await authClient.signOut();
        window.location.assign("/login");
      }}
    >
      Sign out
    </button>
  );
}
