import { updateStep } from "@/app/actions";
import type { TimelineStep } from "@/lib/queries";
import { formatDate } from "@/lib/format";
import { ProfessionTag, StepStatusBadge } from "./ui";
import { SubmitButton } from "./submit-button";

const DOT: Record<TimelineStep["status"], string> = {
  realisee: "bg-done border-done text-white",
  en_cours: "bg-current-soft border-current text-current",
  a_venir: "bg-surface border-border text-upcoming",
};

function plannedDate(startDate: string, weekOffset: number) {
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + weekOffset * 7);
  return d.toISOString().slice(0, 10);
}

export function Timeline({
  steps,
  startDate,
  canEdit = () => false,
  audience,
}: {
  steps: TimelineStep[];
  startDate: string;
  canEdit?: (step: TimelineStep) => boolean;
  audience: "practitioner" | "patient";
}) {
  return (
    <ol className="relative">
      {steps.map((step, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className="absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5 bg-border" aria-hidden />}
            <span
              className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold ${DOT[step.status]}`}
              aria-hidden
            >
              {step.status === "realisee" ? "✓" : step.position}
            </span>
            <div className={`min-w-0 flex-1 ${step.status === "en_cours" ? "rounded-lg bg-current-soft/50 p-3 -mt-1" : ""}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">{step.title}</h3>
                <StepStatusBadge status={step.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <ProfessionTag profession={step.profession} />
                {step.practitioner_name && <span className="text-xs text-muted">{step.practitioner_name}</span>}
                <span className="text-xs text-muted">
                  {step.status === "realisee"
                    ? `Réalisée le ${formatDate(step.completed_at)}`
                    : `Prévue semaine ${step.week_offset} · vers le ${formatDate(plannedDate(startDate, step.week_offset), { day: "numeric", month: "short" })}`}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-muted">{step.description}</p>
              {step.summary && audience === "practitioner" && (
                <p className="mt-1.5 text-sm">
                  <span className="font-medium">Compte rendu : </span>
                  {step.summary}
                </p>
              )}
              {step.profession !== "patient" && step.status !== "realisee" && canEdit(step) && (
                <form action={updateStep} className="mt-3 flex flex-wrap items-end gap-2">
                  <input type="hidden" name="stepId" value={step.id} />
                  <input
                    name="summary"
                    placeholder="Compte rendu court (optionnel)"
                    className="input max-w-sm flex-1"
                    aria-label={`Compte rendu pour ${step.title}`}
                  />
                  {step.status === "a_venir" && (
                    <SubmitButton variant="secondary" name="status" value="en_cours">
                      Démarrer
                    </SubmitButton>
                  )}
                  <SubmitButton name="status" value="realisee">
                    Marquer réalisée
                  </SubmitButton>
                </form>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
