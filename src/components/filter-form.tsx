"use client";

import type { ReactNode } from "react";

/** A GET filter form that applies a drop-down choice straight away; free text still waits for Enter or the button. */
export function FilterForm({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <form
      method="get"
      className={className}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}
