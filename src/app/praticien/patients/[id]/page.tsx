import Link from "next/link";
import { addNote, saveReport, scheduleSession, setSessionStatus, updateStep } from "@/app/actions";
import { requirePractitioner } from "@/lib/auth";
import { BILAN_DIMENSIONS, NOTE_VISIBILITY_LABEL, PROFESSION_LABEL, intakeRedFlags } from "@/lib/domain";
import { ACTION_LABEL, age, daysUntil, formatDate, formatDateTime, fullName } from "@/lib/format";
import { getPatientFileForPractitioner, type ReportRow, type TimelineStep } from "@/lib/queries";
import { Badge, Card, EmptyState, EnrollmentStatusBadge, Notice, OfferBadge, ProfessionTag, ProgressBar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { IntakeView } from "@/components/intake-view";
import { CheckinTable } from "@/components/checkins";
import { SubmitButton } from "@/components/submit-button";

const VISIBILITY_TONE = {
  equipe: "bg-brand-soft text-brand",
  privee: "bg-upcoming-soft text-upcoming",
  patient: "bg-sky-50 text-sky-700",
} as const;

function ReportForm({ enrollmentId, report }: { enrollmentId: string; report?: ReportRow }) {
  return (
    <form action={saveReport} className="space-y-3">
      <input type="hidden" name="enrollmentId" value={enrollmentId} />
      {BILAN_DIMENSIONS.map((d) => (
        <div key={d.id}>
          <label className="label" htmlFor={`f-${d.id}`}>{d.label}</label>
          <textarea id={`f-${d.id}`} name={`f-${d.id}`} rows={2} defaultValue={report?.findings[d.id] ?? ""} className="input" />
        </div>
      ))}
      <div>
        <label className="label" htmlFor="recommendations">Recommandations</label>
        <textarea id="recommendations" name="recommendations" rows={2} defaultValue={report?.recommendations ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="action_plan">Plan d&apos;action (une action par ligne)</label>
        <textarea id="action_plan" name="action_plan" rows={4} defaultValue={report?.action_plan ?? ""} className="input" />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {!report?.published_at && <SubmitButton variant="secondary" name="intent" value="draft">Enregistrer le brouillon</SubmitButton>}
        <SubmitButton name="intent" value="publish">{report?.published_at ? "Mettre à jour" : "Remettre au patient"}</SubmitButton>
      </div>
    </form>
  );
}

export default async function PatientFilePage({ params }: PageProps<"/praticien/patients/[id]">) {
  const me = await requirePractitioner();
  const { id } = await params;
  const file = getPatientFileForPractitioner(me, id);

  if (!file) {
    return (
      <div className="mx-auto max-w-xl py-12">
        <Card>
          <h1 className="mb-2 text-lg font-semibold">Accès refusé</h1>
          <p className="text-sm text-muted">
            Ce patient ne vous a pas accepté dans son équipe de soins. Le secret médical (art. L1110-4 du code de la santé publique)
            limite l&apos;accès aux professionnels qui participent à sa prise en charge.
          </p>
          <p className="mt-2 text-sm text-muted">Cette tentative d&apos;accès a été enregistrée dans le journal.</p>
          <Link href="/praticien" className="btn btn-secondary mt-4">Retour à mes patients</Link>
        </Card>
      </div>
    );
  }

  const { patient, enrollment, team, timeline, sessions, notes, checkins, intake, reports } = file;
  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => s.status === "prevue" && s.starts_at >= now);
  const past = sessions.filter((s) => s.status !== "prevue" || s.starts_at < now).reverse();
  const done = timeline.filter((s) => s.status === "realisee").length;
  const total = timeline.filter((s) => s.status !== "non_retenue").length;
  const raceIn = daysUntil(enrollment.goal_date);
  const today = now.slice(0, 10);
  const isReferent = team.some((m) => m.id === me.id && m.is_referent === 1);
  const editable = enrollment.status !== "termine";
  const myReport = reports.find((r) => r.author_id === me.id);
  const bilanStep = timeline.find((s) => s.title === "Bilan de course (30 min)");
  const canWriteReport = me.profession === "kine" && (isReferent || bilanStep?.practitioner_id === me.id);
  const openSteps = timeline.filter((s) => s.status === "a_venir" || s.status === "en_cours");
  // Warning signs, limited to the sections this practitioner is allowed to read.
  const visibleSections = new Set(file.intakeSections.map((s) => s.id));
  const redFlags = intake?.submitted_at ? intakeRedFlags(intake.answers).filter((f) => visibleSections.has(f.section)) : [];

  const stepActions = (step: TimelineStep) => {
    if (!editable || step.status === "realisee" || step.status === "non_retenue") return null;
    if (step.profession === "patient" || step.profession === "coordinateur") return null;
    if (step.profession !== me.profession && !isReferent) return null;
    if (step.title === "Plan d'action remis") {
      return <p className="mt-2 text-xs text-muted">Se valide en remettant le compte rendu ci-dessous.</p>;
    }
    return (
      <form action={updateStep} className="mt-3 flex flex-wrap items-end gap-2">
        <input type="hidden" name="stepId" value={step.id} />
        <input name="summary" placeholder="Compte rendu court (optionnel)" className="input max-w-sm flex-1" aria-label={`Compte rendu pour ${step.title}`} />
        {step.status === "a_venir" && <SubmitButton variant="secondary" name="status" value="en_cours">Démarrer</SubmitButton>}
        <SubmitButton name="status" value="realisee">Marquer réalisée</SubmitButton>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <Link href="/praticien" className="text-sm text-muted hover:text-foreground">← Mes patients</Link>

      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{patient.first_name} {patient.last_name}</h1>
          <OfferBadge offer={enrollment.offer} />
          <EnrollmentStatusBadge status={enrollment.status} />
        </div>
        <p className="mt-1 text-sm text-muted">
          {age(patient.birth_date)} ans · né{patient.sex === "F" ? "e" : ""} le {formatDate(patient.birth_date)} · {patient.phone} · {patient.email}
        </p>
        <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="label">Objectif</p>
            <p className="font-medium">{enrollment.goal_title}</p>
            {enrollment.goal_detail && <p className="text-sm text-muted">{enrollment.goal_detail}</p>}
          </div>
          <div>
            <p className="label">Échéance</p>
            {enrollment.goal_date ? (
              <>
                <p className="font-medium">{formatDate(enrollment.goal_date)}</p>
                <p className="text-sm text-muted">{raceIn !== null && raceIn >= 0 ? `J-${raceIn}` : "Passée"}</p>
              </>
            ) : (
              <p className="text-sm text-muted">Pas de date fixée</p>
            )}
          </div>
          <div>
            <p className="label">Coordination</p>
            <p className="font-medium">{enrollment.coordinator_name}</p>
            <p className="text-sm text-muted">
              {enrollment.coordinated_until ? `Jusqu'au ${formatDate(enrollment.coordinated_until)}` : "Bilan de course seul"}
            </p>
          </div>
          <div>
            <p className="label">Progression</p>
            <ProgressBar done={done} total={total} />
          </div>
        </div>
      </section>

      {enrollment.sharing_opposed === 1 && (
        <Notice tone="current">
          <strong>Le patient s&apos;est opposé au partage d&apos;informations entre praticiens</strong>
          {enrollment.consent_updated_at && <> (le {formatDate(enrollment.consent_updated_at)})</>}. Vous ne voyez que vos propres notes et
          comptes rendus{file.hiddenNotesCount > 0 && <> — {file.hiddenNotesCount} note{file.hiddenNotesCount > 1 ? "s" : ""} de vos confrères sont masquées</>}.
          Droit d&apos;opposition prévu à l&apos;art. L1110-4 IV du code de la santé publique.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card title="Parcours" action={<span className="text-xs text-muted">{done} étape{done > 1 ? "s" : ""} réalisée{done > 1 ? "s" : ""} sur {total}</span>}>
            <Timeline steps={timeline} startDate={enrollment.start_date} showSummaries actions={stepActions} />
          </Card>

          <Card title="Compte rendu du bilan de course">
            {reports.length === 0 && !canWriteReport && <EmptyState>Pas encore de compte rendu.</EmptyState>}
            {reports.map((r) => (
              <div key={r.id} className="mb-4 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{r.title}</p>
                    <p className="text-xs text-muted">
                      {r.author_id === me.id ? "Vous" : r.author_name} · {r.published_at ? `remis le ${formatDate(r.published_at)}` : "brouillon"}
                    </p>
                  </div>
                  <Link href={`/compte-rendu/${r.id}`} className="btn btn-secondary">Ouvrir / PDF</Link>
                </div>
                {r.action_plan && (
                  <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
                    {r.action_plan.split("\n").filter(Boolean).map((l) => <li key={l}>{l}</li>)}
                  </ol>
                )}
              </div>
            ))}
            {canWriteReport && editable && (
              <details className="rounded-lg border border-border" open={!myReport}>
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium text-brand">
                  {myReport ? "Modifier mon compte rendu" : "Rédiger le compte rendu (6 dimensions du bilan)"}
                </summary>
                <div className="border-t border-border p-4">
                  <ReportForm enrollmentId={enrollment.id} report={myReport} />
                </div>
              </details>
            )}
          </Card>

          <Card title="Notes de suivi">
            <form action={addNote} className="mb-5 space-y-2">
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <textarea name="body" required rows={3} className="input" placeholder="Observation, conseil, point de coordination…" aria-label="Nouvelle note" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <fieldset className="flex flex-wrap gap-3 text-sm">
                  <legend className="sr-only">Visibilité</legend>
                  {(["equipe", "privee", "patient"] as const).map((v) => (
                    <label key={v} className="flex items-center gap-1.5">
                      <input type="radio" name="visibility" value={v} defaultChecked={v === "equipe"} />
                      {NOTE_VISIBILITY_LABEL[v]}
                    </label>
                  ))}
                </fieldset>
                <SubmitButton>Ajouter la note</SubmitButton>
              </div>
            </form>
            {notes.length === 0 ? (
              <EmptyState>Aucune note visible.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-border p-3">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-medium text-foreground">{n.author_id === me.id ? "Vous" : n.author_name}</span>
                      <ProfessionTag profession={n.profession} />
                      <span className="text-muted">{formatDateTime(n.created_at)}</span>
                      <Badge className={`ml-auto ${VISIBILITY_TONE[n.visibility]}`}>{NOTE_VISIBILITY_LABEL[n.visibility]}</Badge>
                    </div>
                    <p className="text-sm whitespace-pre-line">{n.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {enrollment.offer === "parcours" && (
            <Card title="Suivi hebdomadaire déclaré par le patient">
              <CheckinTable checkins={checkins} />
            </Card>
          )}

          <Card
            title="Questionnaire"
            action={intake?.submitted_at ? <span className="text-xs text-muted">Envoyé le {formatDate(intake.submitted_at)}</span> : <Badge className="bg-danger-soft text-danger">Non envoyé</Badge>}
          >
            {intake?.submitted_at ? (
              <>
                {redFlags.length > 0 && (
                  <div className="mb-5 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                    <p className="font-semibold">Points d&apos;attention dans les réponses</p>
                    <ul className="mt-1 list-disc pl-5">
                      {redFlags.map((f) => <li key={f.label}>{f.label}</li>)}
                    </ul>
                    {redFlags.some((f) => f.section === "cardio") && (
                      <p className="mt-2 text-xs">Signes cardiovasculaires : un avis médical est recommandé avant la reprise de l&apos;effort intense.</p>
                    )}
                  </div>
                )}
                <IntakeView sections={file.intakeSections} answers={intake.answers} />
              </>
            ) : (
              <EmptyState>Le patient n&apos;a pas encore envoyé son questionnaire.</EmptyState>
            )}
            {file.hiddenIntakeSections.length > 0 && (
              <p className="mt-4 rounded-lg bg-background px-3 py-2 text-xs text-muted">
                Sections non affichées car non nécessaires à votre exercice ({PROFESSION_LABEL[me.profession].toLowerCase()}) :{" "}
                {file.hiddenIntakeSections.map((s) => s.title.toLowerCase()).join(", ")}.
              </p>
            )}
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Équipe de soins">
            <ul className="space-y-2.5">
              {team.filter((m) => m.status !== "refusee").map((m) => (
                <li key={m.id} className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">{fullName(m)} {m.id === me.id && <span className="text-muted">(vous)</span>}</p>
                    <ProfessionTag profession={m.profession} />
                  </div>
                  {m.status === "proposee" ? (
                    <Badge className="bg-current-soft text-current">Proposé·e</Badge>
                  ) : m.is_referent === 1 ? (
                    <Badge className="bg-brand-soft text-brand">Référent bilan</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Équipe composée par la coordination ({enrollment.coordinator_name}) et validée par le patient.</p>
          </Card>

          <Card title="Séances">
            <h3 className="mb-2 text-xs font-semibold text-muted uppercase">À venir</h3>
            {upcoming.length === 0 ? (
              <p className="mb-4 text-sm text-muted">Aucune séance planifiée.</p>
            ) : (
              <ul className="mb-4 space-y-2.5">
                {upcoming.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border p-2.5">
                    <p className="text-sm font-medium first-letter:uppercase">{formatDateTime(s.starts_at)}</p>
                    <p className="text-xs text-muted">{s.step_title ?? "Séance de suivi"} · {s.practitioner_name}</p>
                    {s.practitioner_id === me.id && (
                      <form action={setSessionStatus} className="mt-2 flex gap-2">
                        <input type="hidden" name="sessionId" value={s.id} />
                        <SubmitButton variant="secondary" name="status" value="realisee" className="!px-2 !py-1 text-xs">Réalisée</SubmitButton>
                        <SubmitButton variant="secondary" name="status" value="annulee" className="!px-2 !py-1 text-xs">Annuler</SubmitButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && (
              <details className="mb-4 rounded-lg border border-border">
                <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-brand">+ Planifier une séance</summary>
                <form action={scheduleSession} className="space-y-2 border-t border-border p-3">
                  <input type="hidden" name="enrollmentId" value={enrollment.id} />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="label" htmlFor="date">Date</label>
                      <input id="date" name="date" type="date" required min={today} className="input" />
                    </div>
                    <div>
                      <label className="label" htmlFor="time">Heure</label>
                      <input id="time" name="time" type="time" defaultValue="09:00" className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="stepId">Étape concernée</label>
                    <select id="stepId" name="stepId" className="input" defaultValue={openSteps.find((s) => s.profession === me.profession)?.id ?? ""}>
                      <option value="">Séance de suivi (hors étape)</option>
                      {openSteps.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  <SubmitButton className="w-full">Planifier</SubmitButton>
                </form>
              </details>
            )}
            <h3 className="mb-2 text-xs font-semibold text-muted uppercase">Historique</h3>
            {past.length === 0 ? (
              <p className="text-sm text-muted">Aucune séance passée.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {past.map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className={s.status === "annulee" ? "text-muted line-through" : ""}>
                      {formatDate(s.starts_at, { day: "numeric", month: "short" })} · {s.step_title ?? "Suivi"}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{PROFESSION_LABEL[s.profession]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Journal des accès">
            <p className="mb-3 text-xs text-muted">Chaque consultation ou modification du dossier est tracée. Le patient voit ce journal.</p>
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
