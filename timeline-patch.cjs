const fs = require("fs");
const f = "components/timeline.tsx";
let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing " + a.slice(0, 40)); s = s.replace(a, b); };
rep(` * (\`showSummaries\` is false for anyone who must not read the
 * practitioners' clinical summaries (patient, coordinator).
 */`, ` * (\`showSummaries\` is false for anyone who must not read the
 * practitioners' clinical summaries (patient, coordinator).
 * \`collapseFinished\` folds a phase whose steps are all behind the patient.
 */`);
rep(`  actions,
}: {`, `  actions,
  collapseFinished = false,
}: {`);
rep(`  actions?: (step: TimelineStep) => ReactNode;
}) {`, `  actions?: (step: TimelineStep) => ReactNode;
  collapseFinished?: boolean;
}) {`);
rep(`      {phases.map((phase) => (
        <div key={phase}>
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-muted uppercase">{PHASE_LABEL[phase]}</h3>
          <ol>`, `      {phases.map((phase) => {
        const inPhase = steps.filter((s) => s.phase === phase);
        const finished = inPhase.every((s) => s.status === "realisee" || s.status === "non_retenue");
        const list = (
          <ol>`);
rep(`          </ol>
        </div>
      ))}
    </div>`, `          </ol>
        );
        if (collapseFinished && finished) {
          const doneCount = inPhase.filter((s) => s.status === "realisee").length;
          return (
            <details key={phase} className="group rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-done text-xs font-semibold text-white" aria-hidden>✓</span>
                <span className="flex-1">
                  <span className="block text-sm font-medium">{PHASE_LABEL[phase]} : terminé</span>
                  <span className="block text-xs text-muted">{doneCount} étape{doneCount > 1 ? "s" : ""} réalisée{doneCount > 1 ? "s" : ""}</span>
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
    </div>`);
fs.writeFileSync(f, s);
