import type { IntakeAnswers, IntakeField, IntakeSection } from "@/lib/domain";
import { formatDate } from "@/lib/format";

function display(field: IntakeField, value: IntakeAnswers[string] | undefined) {
  if (value === null || value === undefined || value === "") return <span className="text-muted">Non renseigné</span>;
  if (field.type === "boolean") return value ? "Oui" : "Non";
  if (field.type === "date") return formatDate(String(value));
  if (field.type === "number" && field.unit) return `${value} ${field.unit}`;
  return String(value);
}

export function IntakeView({ sections, answers }: { sections: IntakeSection[]; answers: IntakeAnswers }) {
  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.id}>
          <h3 className="mb-1.5 text-sm font-semibold">{section.title}</h3>
          <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            {section.fields.map((field) => (
              <div key={field.id} className="contents">
                <dt className="text-muted">{field.label}</dt>
                <dd className="whitespace-pre-line">{display(field, answers[field.id])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
