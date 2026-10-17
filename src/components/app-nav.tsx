"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Section links of a space; the current one is highlighted (exact match for the space's home). */
export function AppNav({ home, items }: { home: string; items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Navigation principale">
      {items.map((item) => {
        const active = item.href === home ? pathname === home || pathname.startsWith(`${home}/patients`) : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-md px-2.5 py-1.5 sm:px-3 whitespace-nowrap transition ${
              active ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-background hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
