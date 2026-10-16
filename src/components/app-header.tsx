import Link from "next/link";
import { logout } from "@/app/actions";

export function AppHeader({
  home,
  space,
  userName,
  userDetail,
  nav,
}: {
  home: string;
  space: string;
  userName: string;
  userDetail: string;
  nav: { href: string; label: string }[];
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href={home} className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">VS</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold">Via Sana</span>
            <span className="block text-xs text-muted">{space}</span>
          </span>
        </Link>
        <nav className="flex gap-1 text-sm">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-3 py-1.5 text-muted hover:bg-background hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted">{userDetail}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-secondary">Se déconnecter</button>
          </form>
        </div>
      </div>
      <p className="bg-brand-soft px-4 py-1 text-center text-xs text-brand">
        Prototype de démonstration — toutes les données sont fictives.
      </p>
    </header>
  );
}
