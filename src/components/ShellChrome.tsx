"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ICONS, LogOutIcon, MenuIcon, XIcon } from "@/components/icons";
import { Avatar, cn } from "@/components/ui";
import { authClient } from "@/lib/auth-client";
import type { NavLink } from "@/lib/nav";

type Props = {
  links: NavLink[];
  roleLabel: string;
  userName: string;
  userEmail: string;
  bell: ReactNode;
  children: ReactNode;
};

/** The longest link that matches the current path is the active one ("/admin" vs "/admin/users"). */
function activeHref(pathname: string, links: NavLink[]) {
  return links
    .filter((l) => pathname === l.href || pathname.startsWith(`${l.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">IP</span>
      <span className="text-[15px] font-semibold tracking-tight text-slate-900">Interview Platform</span>
    </Link>
  );
}

function Nav({ links, current, onNavigate }: { links: NavLink[]; current?: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((l) => {
        const Icon = ICONS[l.icon];
        const active = l.href === current;
        return (
          <Link
            key={l.href}
            href={l.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <Icon className={active ? "text-brand-600" : "text-slate-400"} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard({ userName, userEmail, roleLabel }: { userName: string; userEmail: string; roleLabel: string }) {
  const router = useRouter();
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="flex items-center gap-3 rounded-lg p-2">
      <Avatar name={userName} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900">{userName}</p>
        <p className="truncate text-xs text-slate-500">{roleLabel} · {userEmail}</p>
      </div>
      <button
        onClick={signOut}
        title="Sign out"
        aria-label="Sign out"
        className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <LogOutIcon />
      </button>
    </div>
  );
}

export function ShellChrome({ links, roleLabel, userName, userEmail, bell, children }: Props) {
  const pathname = usePathname();
  const current = activeHref(pathname, links);
  const [open, setOpen] = useState(false);


  const pageTitle = links.find((l) => l.href === current)?.label ?? "";

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-100 px-4">
          <Brand />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">{roleLabel}</p>
          <Nav links={links} current={current} />
        </div>
        <div className="border-t border-slate-100 p-3">
          <UserCard userName={userName} userEmail={userEmail} roleLabel={roleLabel} />
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-4">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                <XIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <Nav links={links} current={current} onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-slate-100 p-3">
              <UserCard userName={userName} userEmail={userEmail} roleLabel={roleLabel} />
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/85 px-4 backdrop-blur sm:px-6">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="-ml-1 rounded-md p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
            <MenuIcon />
          </button>
          <p className="truncate text-sm font-medium text-slate-500">{pageTitle}</p>
          <div className="ml-auto flex items-center gap-2">
            {bell}
            <div className="hidden items-center gap-2 border-l border-slate-200 pl-3 sm:flex lg:hidden">
              <Avatar name={userName} size="sm" />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
