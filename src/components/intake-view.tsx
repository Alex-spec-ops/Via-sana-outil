import type { IntakeAnswers, IntakeField, IntakeSection } from "@/lib/domain";
import { formatDate } from "@/lib/format";

function display(field: IntakeField, value: IntakeAnswers[string] | undefined) {
  const empty = <span className="text-muted">Non renseigné</span>;
  if (value === null || value === undefined || value === "") return empty;
  if (Array.isArray(value)) return value.length ? value.join(", ") : empty;
  if (field.type === "date") return formatDate(String(value));
  if ((field.type === "number" || field.type === "range") && field.unit) return `${value} ${field.unit}`;
  return String(value);
}

export function IntakeView({ sections, answers }: { sections: IntakeSection[]; answers: IntakeAnswers }) {
  return (
    <div className="space-y-5">
      {sections.map((section, i) => {
        const header = i === 0 || sections[i - 1].group !== section.group;
        return (
          <div key={section.id}>
            {header && <p className="mb-2 text-xs font-semibold tracking-wide text-brand uppercase">{section.group}</p>}
            <h3 className="mb-1.5 text-sm font-semibold">{section.title}</h3>
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              {section.fields.map((field) => (
                <div key={field.id} className="contents">
                  <dt className="text-muted">{field.label}</dt>
                  <dd className="whitespace-pre-line">{display(field, answers[field.id])}</dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
