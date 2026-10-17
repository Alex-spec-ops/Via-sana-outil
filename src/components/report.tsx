import { BILAN_DIMENSIONS, PROFESSION_LABEL } from "@/lib/domain";
import { age, formatDate } from "@/lib/format";
import type { EnrollmentRow, PatientRow, ReportRow } from "@/lib/queries";
import { Wordmark } from "@/components/wordmark";

/** The "bilan de course" report, laid out to read on screen and print to PDF. */
export function ReportDocument({ report, patient, enrollment }: { report: ReportRow; patient: PatientRow; enrollment: EnrollmentRow }) {
  const plan = report.action_plan.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <article className="card mx-auto max-w-3xl p-8 print:max-w-none print:border-0 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-3">
          <div>
            <Wordmark />
            <h1 className="mt-5 text-3xl">{report.title}</h1>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">{patient.first_name} {patient.last_name}</p>
          <p className="text-muted">{age(patient.birth_date)} ans · {enrollment.goal_title}</p>
          <p className="text-muted">{report.published_at ? `Remis le ${formatDate(report.published_at)}` : "Brouillon non publié"}</p>
        </div>
      </header>

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Observations</h2>
        <dl className="divide-y divide-border">
          {BILAN_DIMENSIONS.map((d) => (
            <div key={d.id} className="grid gap-1 py-2.5 sm:grid-cols-[220px_1fr] sm:gap-4">
              <dt className="text-sm font-medium">{d.label}</dt>
              <dd className="text-sm whitespace-pre-line text-foreground/90">{report.findings[d.id] || <span className="text-muted">—</span>}</dd>
            </div>
          ))}
        </dl>
      </section>

      {report.recommendations && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Recommandations</h2>
          <p className="text-sm whitespace-pre-line">{report.recommendations}</p>
        </section>
      )}

      {plan.length > 0 && (
        <section className="mt-6 rounded-xl bg-brand-soft p-5 print:border print:border-brand/30">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-brand uppercase">Votre plan d&apos;action</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm">
            {plan.map((line) => <li key={line}>{line}</li>)}
          </ol>
        </section>
      )}

      <footer className="mt-8 border-t border-border pt-4 text-xs text-muted">
        <p>
          {report.author_name} · {PROFESSION_LABEL[report.author_profession]}
          {report.author_specialty && ` · ${report.author_specialty}`}
        </p>
        <p className="mt-1">Document couvert par le secret médical. Il ne remplace pas l&apos;avis de votre médecin traitant.</p>
      </footer>
    </article>
  );
}
