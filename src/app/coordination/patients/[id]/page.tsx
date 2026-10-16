import Link from "next/link";
import {
  addPlanStep,
  addRelance,
  completeCoordinationStep,
  coordinateSession,
  proposeMember,
  setEnrollmentStatus,
  skipOptionalStep,
} from "@/app/actions";
import { requireCoordinator } from "@/lib/auth";
import { ENROLLMENT_STATUS_LABEL, PROFESSION_LABEL, type Profession } from "@/lib/domain";
import { ACTION_LABEL, formatDate, formatDateTime, fullName } from "@/lib/format";
import { getLogisticsFile, type TimelineStep } from "@/lib/queries";
import { Badge, Card, EmptyState, EnrollmentStatusBadge, Notice, OfferBadge, ProfessionTag } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { IntakeView } from "@/components/intake-view";
import { SubmitButton } from "@/components/submit-button";

const CHANNEL_LABEL = { email: "Email", sms: "SMS", telephone: "Téléphone" } as const;

export default async function CoordinationFilePage({ params }: PageProps<"/coordination/patients/[id]">) {
  const me = await requireCoordinator();
  const { id } = await params;
  const file = getLogisticsFile(me, id);
  if (!file) {
    return (
      <Card>
        <p className="text-sm text-muted">Parcours introuvable.</p>
      </Card>
    );
  }
  const { patient, enrollment, team, timeline, sessions } = file;
  const accepted = team.filter((m) => m.status === "acceptee");
  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => s.status === "prevue" && s.starts_at >= now);
  const today = now.slice(0, 10);
  const editable = enrollment.status !== "termine";
  const partnersByProfession = file.partners.reduce<Record<string, typeof file.partners>>((acc, p) => {
    (acc[p.profession] ??= []).push(p);
    return acc;
  }, {});

  const stepActions = (step: TimelineStep) => {
    if (!editable || step.status === "realisee" || step.status === "non_retenue") return null;
    if (step.profession === "coordinateur") {
      return (
        <form action={completeCoordinationStep} className="mt-3">
          <input type="hidden" name="stepId" value={step.id} />
          <SubmitButton>Marquer comme faite</SubmitButton>
        </form>
      );
    }
    if (step.profession === "patient") return null;
    const candidates = accepted.filter((m) => m.profession === step.profession);
    const hasSession = upcoming.some((s) => s.enrollment_step_id === step.id);
    return (
      <div className="mt-3 flex flex-wrap items-start gap-2">
        {candidates.length === 0 ? (
          <Badge className="bg-current-soft text-current">
            {team.some((m) => m.status === "proposee" && m.profession === step.profession)
              ? `${PROFESSION_LABEL[step.profession]} proposé·e : en attente de validation par le patient`
              : `Aucun ${PROFESSION_LABEL[step.profession].toLowerCase()} dans l'équipe : à proposer`}
          </Badge>
        ) : (
          <details className="rounded-lg border border-border bg-surface">
            <summary className="cursor-pointer px-3 py-1.5 text-sm font-medium text-brand">
              {hasSession ? "Planifier une autre séance" : "Planifier la séance"}
            </summary>
            <form action={coordinateSession} className="grid gap-2 border-t border-border p-3 sm:grid-cols-[1fr_auto_auto_auto]">
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <input type="hidden" name="stepId" value={step.id} />
              <select name="practitionerId" defaultValue={step.practitioner_id ?? candidates[0].id} className="input" aria-label="Praticien">
                {candidates.map((m) => <option key={m.id} value={m.id}>{fullName(m)}</option>)}
              </select>
              <input name="date" type="date" required min={today} className="input" aria-label="Date" />
              <input name="time" type="time" defaultValue="18:00" className="input" aria-label="Heure" />
              <SubmitButton>Planifier</SubmitButton>
            </form>
          </details>
        )}
        {step.optional === 1 && (
          <form action={skipOptionalStep}>
            <input type="hidden" name="stepId" value={step.id} />
            <SubmitButton variant="secondary">Non retenue</SubmitButton>
          </form>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <Link href="/coordination" className="text-sm text-muted hover:text-foreground">← Tous les parcours</Link>

      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{patient.first_name} {patient.last_name}</h1>
              <OfferBadge offer={enrollment.offer} />
              <EnrollmentStatusBadge status={enrollment.status} />
            </div>
            <p className="mt-1 text-sm text-muted">{patient.phone} · {patient.email}</p>
            <p className="mt-1 text-sm">
              {enrollment.goal_title}
              {enrollment.goal_date && <span className="text-muted"> · course le {formatDate(enrollment.goal_date)}</span>}
            </p>
            {enrollment.coordinated_until && (
              <p className="text-sm text-muted">Coordination incluse jusqu&apos;au {formatDate(enrollment.coordinated_until)}</p>
            )}
          </div>
          <form action={setEnrollmentStatus} className="flex items-center gap-2">
            <input type="hidden" name="enrollmentId" value={enrollment.id} />
            <select name="status" defaultValue={enrollment.status} className="input w-auto" aria-label="Statut du parcours">
              {Object.entries(ENROLLMENT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <SubmitButton variant="secondary">Mettre à jour</SubmitButton>
          </form>
        </div>
      </section>

      <Notice>
        <strong>Vue logistique.</strong> Vous voyez l&apos;organisation du parcours (étapes, rendez-vous, équipe, section
        « Organisation » du questionnaire). Les réponses de santé, les notes et les comptes rendus restent réservés à l&apos;équipe de
        soins : Via Sana n&apos;est pas un établissement de santé.
      </Notice>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card title="Parcours">
            <Timeline steps={timeline} startDate={enrollment.start_date} actions={stepActions} />
            {enrollment.offer === "parcours" && editable && (
              <form action={addPlanStep} className="mt-6 grid gap-2 border-t border-border pt-4 sm:grid-cols-[1fr_120px_auto]">
                <input type="hidden" name="enrollmentId" value={enrollment.id} />
                <div>
                  <label className="label" htmlFor="catalogId">Ajouter une étape selon les besoins du bilan</label>
                  <select id="catalogId" name="catalogId" className="input">
                    {file.catalog.map((c) => (
                      <option key={c.id} value={c.id}>{c.title} — {PROFESSION_LABEL[c.profession]}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="week">Semaine</label>
                  <input id="week" name="week" type="number" min={0} max={52} defaultValue={8} className="input" />
                </div>
                <div className="flex items-end"><SubmitButton>Ajouter</SubmitButton></div>
              </form>
            )}
          </Card>

          <Card title="Relances" action={file.relances[0] && <span className="text-xs text-muted">Dernière le {formatDate(file.relances[0].created_at)}</span>}>
            {editable && (
              <form action={addRelance} className="mb-4 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                <input type="hidden" name="enrollmentId" value={enrollment.id} />
                <select name="channel" className="input" aria-label="Canal">
                  {Object.entries(CHANNEL_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input name="reason" list="relance-reasons" required className="input" placeholder="Motif de la relance" aria-label="Motif" />
                <datalist id="relance-reasons">
                  <option value="Questionnaire en ligne non rempli" />
                  <option value="Choix de la suite après le bilan" />
                  <option value="Validation de l'équipe proposée" />
                  <option value="Prise de rendez-vous" />
                </datalist>
                <SubmitButton>Enregistrer</SubmitButton>
              </form>
            )}
            {file.relances.length === 0 ? (
              <p className="text-sm text-muted">Aucune relance.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {file.relances.map((r) => (
                  <li key={r.id} className="flex justify-between gap-3">
                    <span>{r.reason}</span>
                    <span className="shrink-0 text-xs text-muted">{CHANNEL_LABEL[r.channel]} · {formatDate(r.created_at, { day: "numeric", month: "short" })}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Équipe de soins">
            <ul className="space-y-2.5">
              {team.map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{fullName(m)}</p>
                    <ProfessionTag profession={m.profession} />
                  </div>
                  {m.status === "acceptee" ? (
                    m.is_referent === 1 ? <Badge className="bg-brand-soft text-brand">Référent bilan</Badge> : <Badge className="bg-done-soft text-done">Validé</Badge>
                  ) : m.status === "proposee" ? (
                    <Badge className="bg-current-soft text-current">En attente du patient</Badge>
                  ) : (
                    <Badge className="bg-upcoming-soft text-upcoming">Refusé</Badge>
                  )}
                </li>
              ))}
            </ul>
            {editable && file.partners.length > 0 && (
              <form action={proposeMember} className="mt-4 space-y-2 border-t border-border pt-4">
                <input type="hidden" name="enrollmentId" value={enrollment.id} />
                <label className="label" htmlFor="practitionerId">Proposer un praticien du réseau</label>
                <select id="practitionerId" name="practitionerId" className="input">
                  {Object.entries(partnersByProfession).map(([profession, list]) => (
                    <optgroup key={profession} label={PROFESSION_LABEL[profession as Profession]}>
                      {list.map((p) => <option key={p.id} value={p.id}>{fullName(p)} — {p.location}</option>)}
                    </optgroup>
                  ))}
                </select>
                <SubmitButton className="w-full">Proposer au patient</SubmitButton>
                <p className="text-xs text-muted">Le praticien n&apos;accède au dossier qu&apos;après acceptation par le patient.</p>
              </form>
            )}
          </Card>

          <Card title="Séances à venir">
            {upcoming.length === 0 ? (
              <EmptyState>Aucune séance planifiée.</EmptyState>
            ) : (
              <ul className="space-y-2.5">
                {upcoming.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border p-2.5">
                    <p className="text-sm font-medium first-letter:uppercase">{formatDateTime(s.starts_at)}</p>
                    <p className="text-xs text-muted">{s.step_title ?? "Séance"} · {s.practitioner_name}</p>
                    <p className="text-xs text-muted">{s.location}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card
            title="Questionnaire"
            action={file.intakeSubmittedAt ? <Badge className="bg-done-soft text-done">Envoyé le {formatDate(file.intakeSubmittedAt, { day: "numeric", month: "short" })}</Badge> : <Badge className="bg-danger-soft text-danger">Non envoyé</Badge>}
          >
            {file.intakeSubmittedAt ? (
              <IntakeView sections={file.organisation} answers={file.organisationAnswers} />
            ) : (
              <p className="text-sm text-muted">Le patient n&apos;a pas encore rempli son questionnaire.</p>
            )}
            <p className="mt-3 text-xs text-muted">Seule la section « Organisation » vous est visible.</p>
          </Card>

          <Card title="Plan d'action">
            <p className="text-sm">
              {file.reportPublished ? "Remis au patient." : "Pas encore remis."}
            </p>
            <p className="mt-1 text-xs text-muted">Le contenu du compte rendu est réservé au patient et à son équipe de soins.</p>
          </Card>

          <Card title="Journal des accès">
            <ul className="space-y-1.5 text-xs">
              {file.accessLogs.map((l) => (
                <li key={l.id} className={l.allowed ? "" : "text-danger"}>
                  <span className="text-muted">{formatDateTime(l.at)}</span> — {l.actor_name}{" "}
                  {l.allowed ? ACTION_LABEL[l.action] ?? l.action : "— accès refusé"}
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
