import Link from "next/link";
import { logout } from "@/app/actions";
import { AppNav } from "./app-nav";
import { Wordmark } from "./wordmark";

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
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5 sm:py-3">
        <Link href={home} className="flex items-center gap-2">
          <Wordmark sub={`Via Sana · ${space}`} />
        </Link>
        {/* On a phone the links move to their own scrollable row, under the logo and the account. */}
        <div className="order-last w-full sm:order-none sm:w-auto">
          <AppNav home={home} items={nav} />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-sm font-medium">{userName}</p>
            <p className="text-xs text-muted">{userDetail}</p>
          </div>
          <form action={logout}>
            <button type="submit" className="btn btn-secondary px-3 text-sm" title={`Connecté·e : ${userName}`}>Se déconnecter</button>
          </form>
        </div>
      </div>
      <p className="bg-brand-soft px-4 py-1 text-center text-xs text-brand">
        Prototype de démonstration — toutes les données sont fictives.
      </p>
    </header>
  );
}
