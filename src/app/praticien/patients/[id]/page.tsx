import Link from "next/link";
import { addNote, scheduleSession, setEnrollmentStatus, setSessionStatus } from "@/app/actions";
import { requirePractitioner } from "@/lib/auth";
import {
  ENROLLMENT_STATUS_LABEL,
  NOTE_VISIBILITY_LABEL,
  PROFESSION_LABEL,
} from "@/lib/domain";
import { ACTION_LABEL, age, daysUntil, formatDate, formatDateTime, fullName, weekOfPathway } from "@/lib/format";
import { getPatientFileForPractitioner } from "@/lib/queries";
import { Badge, Card, EmptyState, EnrollmentStatusBadge, ProfessionTag, ProgressBar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { IntakeView } from "@/components/intake-view";
import { CheckinTable } from "@/components/checkins";
import { SubmitButton } from "@/components/submit-button";

const VISIBILITY_TONE = {
  equipe: "bg-brand-soft text-brand",
  privee: "bg-upcoming-soft text-upcoming",
  patient: "bg-sky-50 text-sky-700",
} as const;

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
            Vous ne faites pas partie de l&apos;équipe de soins de ce patient. Le secret médical (art. L1110-4 du code de la
            santé publique) limite l&apos;accès aux professionnels qui participent à sa prise en charge.
          </p>
          <p className="mt-2 text-sm text-muted">Cette tentative d&apos;accès a été enregistrée dans le journal.</p>
          <Link href="/praticien" className="btn btn-secondary mt-4">Retour à mes patients</Link>
        </Card>
      </div>
    );
  }

  const { patient, enrollment, team, timeline, sessions, notes, checkins, intake } = file;
  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => s.status === "prevue" && s.starts_at >= now);
  const past = sessions.filter((s) => s.status !== "prevue" || s.starts_at < now).reverse();
  const done = timeline.filter((s) => s.status === "realisee").length;
  const raceIn = daysUntil(enrollment.goal_date);
  const week = weekOfPathway(enrollment.start_date);
  const openSteps = timeline.filter((s) => s.status !== "realisee" && s.profession !== "patient");
  const today = new Date().toISOString().slice(0, 10);
  const isReferent = team.some((m) => m.id === me.id && m.is_referent === 1);

  return (
    <div className="space-y-6">
      <Link href="/praticien" className="text-sm text-muted hover:text-foreground">← Mes patients</Link>

      {/* Identity & goal */}
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold">{patient.first_name} {patient.last_name}</h1>
              <EnrollmentStatusBadge status={enrollment.status} />
            </div>
            <p className="mt-1 text-sm text-muted">
              {age(patient.birth_date)} ans · né{patient.sex === "F" ? "e" : ""} le {formatDate(patient.birth_date)} · {patient.phone} · {patient.email}
            </p>
          </div>
          <form action={setEnrollmentStatus} className="flex items-center gap-2">
            <input type="hidden" name="enrollmentId" value={enrollment.id} />
            <select name="status" defaultValue={enrollment.status} className="input w-auto" aria-label="Statut du parcours">
              {Object.entries(ENROLLMENT_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <SubmitButton variant="secondary">Mettre à jour</SubmitButton>
          </form>
        </div>

        <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="label">Objectif</p>
            <p className="font-medium">{enrollment.goal_title}</p>
            {enrollment.goal_detail && <p className="text-sm text-muted">{enrollment.goal_detail}</p>}
          </div>
          <div>
            <p className="label">Parcours</p>
            <p className="font-medium">{enrollment.pathway_name}</p>
            <p className="text-sm text-muted">Débuté le {formatDate(enrollment.start_date)} · semaine {Math.min(week, enrollment.duration_weeks)}/{enrollment.duration_weeks}</p>
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
            <p className="label">Progression</p>
            <ProgressBar done={done} total={timeline.length} />
          </div>
        </div>
      </section>

      {enrollment.sharing_opposed === 1 && (
        <div className="rounded-xl border border-current/30 bg-current-soft px-4 py-3 text-sm text-current">
          <strong>Le patient s&apos;est opposé au partage d&apos;informations entre praticiens</strong>
          {enrollment.consent_updated_at && <> (le {formatDate(enrollment.consent_updated_at)})</>}. Vous ne voyez que vos propres
          notes{file.hiddenNotesCount > 0 && <> — {file.hiddenNotesCount} note{file.hiddenNotesCount > 1 ? "s" : ""} de vos confrères sont masquées</>}.
          Droit d&apos;opposition prévu à l&apos;art. L1110-4 IV du code de la santé publique.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Card title="Parcours" action={<span className="text-xs text-muted">{done} étape{done > 1 ? "s" : ""} réalisée{done > 1 ? "s" : ""} sur {timeline.length}</span>}>
            <Timeline
              steps={timeline}
              startDate={enrollment.start_date}
              canEdit={(step) => enrollment.status !== "termine" && (step.profession === me.profession || isReferent)}
              audience="practitioner"
            />
          </Card>

          <Card title="Notes de suivi">
            <form action={addNote} className="mb-5 space-y-2">
              <input type="hidden" name="enrollmentId" value={enrollment.id} />
              <textarea
                name="body"
                required
                rows={3}
                className="input"
                placeholder="Observation, conseil, point de coordination…"
                aria-label="Nouvelle note"
              />
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

          <Card title="Suivi hebdomadaire déclaré par le patient">
            <CheckinTable checkins={checkins} />
          </Card>

          <Card
            title="Formulaire préalable"
            action={
              intake?.submitted_at ? (
                <span className="text-xs text-muted">Envoyé le {formatDate(intake.submitted_at)}</span>
              ) : (
                <Badge className="bg-danger-soft text-danger">Non envoyé</Badge>
              )
            }
          >
            {intake?.submitted_at ? (
              <IntakeView sections={file.intakeSections} answers={intake.answers} />
            ) : (
              <EmptyState>Le patient n&apos;a pas encore envoyé son formulaire préalable.</EmptyState>
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
              {team.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium">
                      {fullName(m)} {m.id === me.id && <span className="text-muted">(vous)</span>}
                    </p>
                    <ProfessionTag profession={m.profession} />
                  </div>
                  {m.is_referent === 1 && <Badge className="bg-brand-soft text-brand">Référent</Badge>}
                </li>
              ))}
            </ul>
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

            {enrollment.status !== "termine" && (
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
                      {openSteps.map((s) => (
                        <option key={s.id} value={s.id}>{s.position}. {s.title}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="duration">Durée (min)</label>
                    <input id="duration" name="duration" type="number" min={15} max={180} step={15} defaultValue={45} className="input" />
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
                    <span className="shrink-0 text-xs text-muted">{PROFESSION_LABEL[s.profession].split(" ")[0]}</span>
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
