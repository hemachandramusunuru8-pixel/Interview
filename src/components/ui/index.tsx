// Shared UI building blocks. Server-safe: no hooks, so pages and client forms can both use them.
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertIcon, CheckCircleIcon, ChevronLeftIcon } from "@/components/icons";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "dangerGhost";
type Size = "sm" | "md";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 disabled:bg-brand-600/60",
  secondary: "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 shadow-sm hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700",
  dangerGhost: "text-red-600 ring-1 ring-inset ring-red-200 hover:bg-red-50",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ---------- Layout ---------- */

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ChevronLeftIcon width={16} height={16} />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h1>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)} {...props} />;
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 py-4", className)} {...props} />;
}

/* ---------- Badges ---------- */

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "purple" | "indigo" | "teal";

const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
  indigo: "bg-brand-50 text-brand-700 ring-brand-200",
  teal: "bg-teal-50 text-teal-700 ring-teal-200",
};

export function Badge({ tone = "gray", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap", TONES[tone])}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- Stats ---------- */

export function StatCard({
  label,
  value,
  hint,
  icon,
  href,
  tone = "indigo",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  href?: string;
  tone?: "indigo" | "green" | "amber" | "blue" | "purple";
}) {
  const iconTone = {
    indigo: "bg-brand-50 text-brand-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-sky-50 text-sky-600",
    purple: "bg-violet-50 text-violet-600",
  }[tone];
  const body = (
    <div className="flex items-start justify-between gap-3 p-5">
      <div>
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
      {icon && <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", iconTone)}>{icon}</div>}
    </div>
  );
  return (
    <Card className={href ? "transition hover:border-brand-200 hover:shadow" : undefined}>
      {href ? <Link href={href} className="block rounded-xl">{body}</Link> : body}
    </Card>
  );
}

/* ---------- Empty state ---------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">{icon}</div>}
      <p className="text-sm font-medium text-slate-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Tables ---------- */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  );
}
export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </thead>
  );
}
export function TH({ children, className }: { children?: ReactNode; className?: string }) {
  return <th className={cn("px-5 py-3 font-medium", className)}>{children}</th>;
}
export function TR({ children, className }: { children: ReactNode; className?: string }) {
  return <tr className={cn("border-b border-slate-100 last:border-0 hover:bg-slate-50/60", className)}>{children}</tr>;
}
export function TD({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cn("px-5 py-3.5 align-middle text-slate-700", className)}>{children}</td>;
}

/* ---------- Forms ---------- */

export const inputClass =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-slate-50";
export const selectClass = cn(inputClass, "pr-8");
export const textareaClass = cn(inputClass, "min-h-28");

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

/* ---------- Messages ---------- */

export function FormMessage({ error, ok }: { error?: string; ok?: string }) {
  if (error) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
        <AlertIcon width={16} height={16} className="mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }
  if (ok) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 ring-1 ring-inset ring-emerald-200">
        <CheckCircleIcon width={16} height={16} className="mt-0.5 shrink-0" />
        <span>{ok}</span>
      </div>
    );
  }
  return null;
}

export function Notice({ children, tone = "gray" }: { children: ReactNode; tone?: "gray" | "amber" | "blue" }) {
  const t = {
    gray: "bg-slate-50 text-slate-600 ring-slate-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    blue: "bg-sky-50 text-sky-800 ring-sky-200",
  }[tone];
  return <div className={cn("rounded-lg px-4 py-3 text-sm ring-1 ring-inset", t)}>{children}</div>;
}

/* ---------- Misc ---------- */

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700",
        size === "sm" ? "h-7 w-7 text-xs" : "h-9 w-9 text-sm",
      )}
    >
      {initials || "?"}
    </span>
  );
}

export function SkillTags({ skills, max = 6 }: { skills: string[]; max?: number }) {
  if (skills.length === 0) return <span className="text-slate-400">-</span>;
  const shown = skills.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <span key={s} className="rounded-md bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">{s}</span>
      ))}
      {skills.length > max && <span className="text-xs text-slate-400">+{skills.length - max}</span>}
    </span>
  );
}
