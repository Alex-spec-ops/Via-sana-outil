"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Section links of a space; the current one is highlighted (exact match for the space's home). */
export function AppNav({ home, items }: { home: string; items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const ref = useRef<HTMLElement>(null);
  // Publish the sticky header's height (it wraps differently per space and width) for in-page sticky bars and anchors.
  useEffect(() => {
    const header = ref.current?.closest("header");
    if (!header) return;
    const update = () => document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);
  return (
    <nav ref={ref} className="-mx-4 flex gap-1 overflow-x-auto px-4 text-sm [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Navigation principale">
      {items.map((item) => {
        const active = item.href === home ? pathname === home || pathname.startsWith(`${home}/patients`) : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-full px-3 py-1.5 font-display text-[13px] tracking-[0.08em] whitespace-nowrap uppercase transition sm:px-3.5 ${
              active ? "bg-brand font-semibold text-ecru" : "text-muted hover:bg-surface-alt hover:text-foreground"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
