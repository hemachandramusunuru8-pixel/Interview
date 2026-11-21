import Link from "next/link";
import { SignOutButton } from "./SignOutButton";

type Props = {
  title: string;
  userName: string;
  links?: { href: string; label: string }[];
  children: React.ReactNode;
};

export function AppShell({ title, userName, links = [], children }: Props) {
  return (
    <div className="mx-auto max-w-4xl p-6">
      <header className="mb-6 flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-6">
          <span className="font-semibold">{title}</span>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="underline">{l.label}</Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>{userName}</span>
          <SignOutButton />
        </div>
      </header>
      {children}
    </div>
  );
}
