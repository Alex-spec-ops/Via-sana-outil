import type { ReactNode } from "react";
import type { TimelineStep } from "@/lib/queries";
import { PHASE_LABEL, type Phase } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { Badge, ProfessionTag, StepStatusBadge } from "./ui";

const DOT: Record<TimelineStep["status"], string> = {
  realisee: "bg-done border-done text-white",
  en_cours: "bg-ongoing-soft border-ongoing text-ongoing",
  a_venir: "bg-surface border-border text-upcoming",
  non_retenue: "bg-background border-border text-upcoming",
};

function plannedDate(startDate: string, week: number) {
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + week * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * The patient's plan, grouped by phase. Each role passes its own actions
 * (`actions`); `showSummaries` is false for anyone who must not read the
 * practitioners' clinical summaries (patient, coordinator).
 * `collapseFinished` folds a phase whose steps are all behind the patient.
 */
export function Timeline({
  steps,
  startDate,
  showSummaries = false,
  actions,
  collapseFinished = false,
}: {
  steps: TimelineStep[];
  startDate: string;
  showSummaries?: boolean;
  actions?: (step: TimelineStep) => ReactNode;
  collapseFinished?: boolean;
}) {
  const phases = (["bilan", "parcours"] as Phase[]).filter((p) => steps.some((s) => s.phase === p));
  // Steps are numbered across phases.
  const offsets = phases.map((_, i) => phases.slice(0, i).reduce((sum, p) => sum + steps.filter((s) => s.phase === p).length, 0));
  return (
    <div className="space-y-6">
      {phases.map((phase, phaseIndex) => {
        const inPhase = steps.filter((s) => s.phase === phase);
        const finished = inPhase.every((s) => s.status === "realisee" || s.status === "non_retenue");
        const list = (
          <ol>
            {inPhase.map((step, i) => {
              const n = offsets[phaseIndex] + i + 1;
              const last = i === inPhase.length - 1;
              const skipped = step.status === "non_retenue";
              return (
                <li key={step.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {!last && <span className="absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5 bg-border" aria-hidden />}
                  <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${DOT[step.status]}`} aria-hidden>
                    {step.status === "realisee" ? "✓" : skipped ? "–" : n}
                  </span>
                  <div className={`min-w-0 flex-1 ${step.status === "en_cours" ? "-mt-1 rounded-lg bg-ongoing-soft/50 p-3" : ""} ${skipped ? "opacity-60" : ""}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-medium">{step.title}</h4>
                      <StepStatusBadge status={step.status} />
                      {step.optional === 1 && !skipped && <Badge className="bg-background text-muted">Optionnelle</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <ProfessionTag profession={step.profession} />
                      {step.practitioner_name && <span className="text-xs text-muted">{step.practitioner_name}</span>}
                      <span className="text-xs text-muted">
                        {step.status === "realisee"
                          ? `Réalisée le ${formatDate(step.completed_at)}`
                          : skipped
                            ? "Non nécessaire pour ce patient"
                            : `Semaine ${step.planned_week} · vers le ${formatDate(plannedDate(startDate, step.planned_week), { day: "numeric", month: "short" })}`}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted">{step.description}</p>
                    {showSummaries && step.summary && (
                      <p className="mt-1.5 text-sm">
                        <span className="font-medium">Compte rendu : </span>
                        {step.summary}
                      </p>
                    )}
                    {actions?.(step)}
                  </div>
                </li>
              );
            })}
          </ol>
        );

        if (collapseFinished && finished) {
          const doneCount = inPhase.filter((s) => s.status === "realisee").length;
          return (
            <details key={phase} className="group rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-done text-xs font-semibold text-white" aria-hidden>✓</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{PHASE_LABEL[phase]} : terminé</span>
                  <span className="block text-xs text-muted">
                    {doneCount} étape{doneCount > 1 ? "s" : ""} réalisée{doneCount > 1 ? "s" : ""}
                  </span>
                </span>
                <span className="text-xs text-brand group-open:hidden">Afficher</span>
                <span className="hidden text-xs text-brand group-open:inline">Masquer</span>
              </summary>
              <div className="border-t border-border px-3 pt-4 pb-3">{list}</div>
            </details>
          );
        }
        return (
          <div key={phase}>
            <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{PHASE_LABEL[phase]}</h3>
            {list}
          </div>
        );
      })}
    </div>
  );
}
