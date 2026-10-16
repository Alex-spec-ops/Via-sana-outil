"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  variant = "primary",
  name,
  value,
  className = "",
}: {
  children: ReactNode;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending} className={`btn btn-${variant} ${className}`}>
      {pending ? "Enregistrement…" : children}
    </button>
  );
}
