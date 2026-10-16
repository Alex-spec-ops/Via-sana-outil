import Link from "next/link";
import { saveIntake } from "@/app/actions";
import { requirePatient } from "@/lib/auth";
import { INTAKE_SECTIONS, PROFESSION_LABEL, type IntakeAnswers, type IntakeField } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { getPatientSpace } from "@/lib/queries";
import { Card, EmptyState } from "@/components/ui";
import { IntakeView } from "@/components/intake-view";
import { SubmitButton } from "@/components/submit-button";

function Field({ field, value }: { field: IntakeField; value: IntakeAnswers[string] | undefined }) {
  const id = `f-${field.id}`;
  const str = value === null || value === undefined ? "" : String(value);
  if (field.type === "boolean") {
    return (
      <fieldset>
        <legend className="label">{field.label}</legend>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5"><input type="radio" name={field.id} value="oui" defaultChecked={value === true} /> Oui</label>
          <label className="flex items-center gap-1.5"><input type="radio" name={field.id} value="non" defaultChecked={value === false} /> Non</label>
        </div>
      </fieldset>
    );
  }
  return (
    <div className={field.type === "textarea" ? "sm:col-span-2" : ""}>
      <label className="label" htmlFor={id}>
        {field.label}
        {field.type === "number" && field.unit ? ` (${field.unit})` : ""}
      </label>
      {field.type === "textarea" ? (
        <textarea id={id} name={field.id} defaultValue={str} rows={2} className="input" />
      ) : field.type === "select" ? (
        <select id={id} name={field.id} defaultValue={str} className="input">
          <option value="">—</option>
          {field.options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : field.type === "number" ? (
        <input id={id} name={field.id} type="number" defaultValue={str} min={field.min} max={field.max} step="any" className="input" />
      ) : (
        <input id={id} name={field.id} type={field.type} defaultValue={str} placeholder={"placeholder" in field ? field.placeholder : undefined} className="input" />
      )}
    </div>
  );
}

export default async function IntakePage({ searchParams }: PageProps<"/patient/formulaire">) {
  const me = await requirePatient();
  const space = getPatientSpace(me.id);
  if (!space) return <EmptyState>Aucun parcours n&apos;est associé à votre compte.</EmptyState>;
  const { intake } = space;
  const { modifier, brouillon } = await searchParams;
  const submitted = Boolean(intake?.submitted_at);
  const editing = !submitted || modifier === "1";
  const answers = intake?.answers ?? {};

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mon formulaire préalable</h1>
          <p className="text-sm text-muted">
            {submitted
              ? `Envoyé le ${formatDate(intake!.submitted_at)}${intake!.updated_at !== intake!.submitted_at ? ` · mis à jour le ${formatDate(intake!.updated_at)}` : ""}`
              : "Ces informations aident votre équipe à préparer votre accompagnement."}
          </p>
        </div>
        {submitted && !editing && (
          <Link href="/patient/formulaire?modifier=1" className="btn btn-secondary">Modifier mes réponses</Link>
        )}
      </div>

      {brouillon === "1" && (
        <div className="rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand">
          Brouillon enregistré. Vous pouvez revenir le compléter à tout moment.
        </div>
      )}

      {!editing ? (
        <Card>
          <IntakeView sections={INTAKE_SECTIONS} answers={answers} />
        </Card>
      ) : (
        <form action={saveIntake} className="space-y-5">
          {INTAKE_SECTIONS.map((section) => (
            <Card
              key={section.id}
              title={section.title}
              action={
                <span className="text-right text-xs text-muted">
                  Visible par : {section.audience.map((p) => PROFESSION_LABEL[p].toLowerCase()).join(", ")}
                </span>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <Field key={field.id} field={field} value={answers[field.id]} />
                ))}
              </div>
            </Card>
          ))}
          <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="max-w-md text-xs text-muted">
              Vos réponses sont couvertes par le secret médical. Chaque praticien de votre équipe ne voit que les sections
              utiles à sa spécialité.{" "}
              <Link href="/patient/confidentialite" className="text-brand hover:underline">En savoir plus</Link>
            </p>
            <div className="flex gap-2">
              {!submitted && <SubmitButton variant="secondary" name="intent" value="draft">Enregistrer le brouillon</SubmitButton>}
              <SubmitButton name="intent" value="submit">{submitted ? "Enregistrer les modifications" : "Envoyer à mon équipe"}</SubmitButton>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
