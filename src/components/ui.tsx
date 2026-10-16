import type { ReactNode } from "react";
import {
  ENROLLMENT_STATUS_LABEL,
  OFFER_LABEL,
  PROFESSION_LABEL,
  STEP_STATUS_LABEL,
  type EnrollmentStatus,
  type Offer,
  type StepOwner,
  type StepStatus,
} from "@/lib/domain";

const STEP_TONE: Record<StepStatus, string> = {
  realisee: "bg-done-soft text-done",
  en_cours: "bg-current-soft text-current",
  a_venir: "bg-upcoming-soft text-upcoming",
  non_retenue: "bg-upcoming-soft text-upcoming line-through",
};

const ENROLLMENT_TONE: Record<EnrollmentStatus, string> = {
  actif: "bg-brand-soft text-brand",
  en_pause: "bg-current-soft text-current",
  termine: "bg-upcoming-soft text-upcoming",
};

export function Badge({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}`}>
      {children}
    </span>
  );
}

export function StepStatusBadge({ status }: { status: StepStatus }) {
  return <Badge className={STEP_TONE[status]}>{STEP_STATUS_LABEL[status]}</Badge>;
}

export function EnrollmentStatusBadge({ status }: { status: EnrollmentStatus }) {
  return <Badge className={ENROLLMENT_TONE[status]}>{ENROLLMENT_STATUS_LABEL[status]}</Badge>;
}

export function OfferBadge({ offer }: { offer: Offer }) {
  return (
    <Badge className={offer === "parcours" ? "bg-sky-50 text-sky-800" : "bg-amber-50 text-amber-800"}>
      {OFFER_LABEL[offer]}
    </Badge>
  );
}

const PROFESSION_DOT: Record<StepOwner, string> = {
  patient: "bg-slate-400",
  coordinateur: "bg-slate-700",
  medecin: "bg-sky-600",
  kine: "bg-emerald-600",
  osteo: "bg-violet-600",
  podologue: "bg-rose-500",
  dieteticien: "bg-amber-500",
  sophrologue: "bg-cyan-500",
  chiropracteur: "bg-lime-600",
  psychologue: "bg-fuchsia-600",
};

export function ProfessionTag({ profession }: { profession: StepOwner }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={`size-2 rounded-full ${PROFESSION_DOT[profession]}`} aria-hidden />
      {PROFESSION_LABEL[profession]}
    </span>
  );
}

export function Card({ title, action, children, className = "" }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-upcoming-soft" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted">{done}/{total}</span>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

export function Notice({ tone = "brand", children }: { tone?: "brand" | "current" | "done" | "danger"; children: ReactNode }) {
  const tones = {
    brand: "border-brand/20 bg-brand-soft text-brand",
    current: "border-current/30 bg-current-soft text-current",
    done: "border-done/30 bg-done-soft text-done",
    danger: "border-danger/30 bg-danger-soft text-danger",
  };
  return <div className={`rounded-xl border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}
