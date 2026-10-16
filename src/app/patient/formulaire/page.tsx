import Link from "next/link";
import { requirePatient } from "@/lib/auth";
import { INTAKE_SECTIONS } from "@/lib/domain";
import { formatDate } from "@/lib/format";
import { getPatientSpace } from "@/lib/queries";
import { Card, EmptyState, Notice } from "@/components/ui";
import { IntakeView } from "@/components/intake-view";
import { IntakeWizard } from "@/components/intake-wizard";

export default async function IntakePage({ searchParams }: PageProps<"/patient/formulaire">) {
  const me = await requirePatient();
  const space = await getPatientSpace(me.id);
  if (!space) return <EmptyState>Aucun parcours n&apos;est associé à votre compte.</EmptyState>;
  const { intake } = space;
  const { modifier, brouillon } = await searchParams;
  const submitted = Boolean(intake?.submitted_at);
  const editing = !submitted || modifier === "1";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Mon questionnaire de bilan</h1>
          <p className="text-sm text-muted">
            {submitted
              ? `Envoyé le ${formatDate(intake!.submitted_at)}${intake!.updated_at !== intake!.submitted_at ? ` · mis à jour le ${formatDate(intake!.updated_at)}` : ""}`
              : "5 minutes · le kinésithérapeute le lit avant votre bilan de course."}
          </p>
        </div>
        {submitted && !editing && (
          <Link href="/patient/formulaire?modifier=1" className="btn btn-secondary">Modifier mes réponses</Link>
        )}
      </div>

      {brouillon === "1" && <Notice>Brouillon enregistré. Vous pouvez revenir le compléter à tout moment.</Notice>}

      {editing ? (
        <IntakeWizard
          sections={INTAKE_SECTIONS}
          answers={intake?.answers ?? {}}
          firstName={me.first_name}
          startAtIntro={!intake}
          submitted={submitted}
        />
      ) : (
        <Card>
          <IntakeView sections={INTAKE_SECTIONS} answers={intake?.answers ?? {}} />
        </Card>
      )}

      <p className="text-center text-xs text-muted">
        Vos réponses sont couvertes par le secret médical : chaque praticien ne voit que les rubriques utiles à sa spécialité.{" "}
        <Link href="/patient/confidentialite" className="text-brand hover:underline">Qui voit quoi ?</Link>
      </p>
    </div>
  );
}
