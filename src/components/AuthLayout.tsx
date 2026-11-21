import type { ReactNode } from "react";
import { CalendarIcon, ClipboardIcon, ShieldIcon } from "@/components/icons";

const POINTS = [
  { icon: CalendarIcon, title: "Teams interviews, booked in a click", text: "Invites go to everyone automatically." },
  { icon: ClipboardIcon, title: "Structured feedback", text: "Ratings and recommendations for every round." },
  { icon: ShieldIcon, title: "Role-based access", text: "Admins, recruiters and panelists see only what they need." },
];

/** Split-screen layout for the sign-in pages: brand panel on large screens, the form on the right. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-indigo-300/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="text-lg font-semibold tracking-tight">Interview Platform</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">
            From resume to decision, every interview in one place.
          </h2>
          <ul className="mt-10 space-y-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
                  <Icon width={20} height={20} />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-indigo-100">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-indigo-200">Secure sign-in for your hiring team.</p>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="text-lg font-semibold tracking-tight">Interview Platform</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
