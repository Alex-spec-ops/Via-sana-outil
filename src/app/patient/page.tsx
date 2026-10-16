import Link from "next/link";
import { addCheckin } from "@/app/actions";
import { requirePatient } from "@/lib/auth";
import { daysUntil, formatDate, formatTime, fullName } from "@/lib/format";
import { getPatientSpace } from "@/lib/queries";
import { Card, EmptyState, ProfessionTag, ProgressBar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { CheckinTable } from "@/components/checkins";
import { SubmitButton } from "@/components/submit-button";

export default async function PatientHome({ searchParams }: PageProps<"/patient">) {
  const me = await requirePatient();
  const space = getPatientSpace(me.id);
  if (!space) return <EmptyState>Aucun parcours n&apos;est associé à votre compte.</EmptyState>;
  const { enrollment, timeline, sessions, notes, checkins, intake, team } = space;
  const { formulaire } = await searchParams;

  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => s.status === "prevue" && s.starts_at >= now);
  const done = timeline.filter((s) => s.status === "realisee").length;
  const current = timeline.find((s) => s.status === "en_cours");
  const raceIn = daysUntil(enrollment.goal_date);
  const formSent = Boolean(intake?.submitted_at);

  return (
    <div className="space-y-6">
      {formulaire === "envoye" && (
        <div className="rounded-xl border border-done/30 bg-done-soft px-4 py-3 text-sm text-done">
          Merci ! Votre formulaire a bien été transmis à votre équipe de soins.
        </div>
      )}

      <section className="card overflow-hidden">
        <div className="bg-brand px-5 py-5 text-white">
          <p className="text-sm opacity-80">{enrollment.pathway_name}</p>
          <h1 className="text-2xl font-semibold">{enrollment.goal_title}</h1>
          <p className="mt-1 text-sm opacity-90">
            {enrollment.goal_date && raceIn !== null && raceIn >= 0
              ? `Plus que ${raceIn} jours — rendez-vous le ${formatDate(enrollment.goal_date, { day: "numeric", month: "long" })}`
              : enrollment.goal_detail}
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="label">Votre progression</p>
            <ProgressBar done={done} total={timeline.length} />
          </div>
          <div>
            <p className="label">Étape en cours</p>
            <p className="font-medium">{current ? current.title : enrollment.status === "termine" ? "Parcours terminé 🎉" : "—"}</p>
            {enrollment.status === "en_pause" && (
              <p className="text-sm text-current">Votre parcours est en pause. Votre équipe vous recontactera pour la reprise.</p>
            )}
          </div>
        </div>
      </section>

      {!formSent && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/30 bg-current-soft px-4 py-3">
          <div>
            <p className="font-medium text-current">Première étape : votre formulaire préalable</p>
            <p className="text-sm text-current">Il permet à vos praticiens de préparer vos premières séances. Comptez 5 minutes.</p>
          </div>
          <Link href="/patient/formulaire" className="btn btn-primary">Remplir mon formulaire</Link>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card title="Mes prochaines séances">
            {upcoming.length === 0 ? (
              <EmptyState>Aucune séance planifiée pour le moment.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((s) => {
                  const d = new Date(s.starts_at);
                  return (
                    <li key={s.id} className="flex gap-4 rounded-lg border border-border p-3">
                      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-soft py-1.5 text-brand">
                        <span className="text-xl leading-none font-semibold">{d.toLocaleDateString("fr-FR", { day: "numeric", timeZone: "Europe/Paris" })}</span>
                        <span className="text-xs uppercase">{d.toLocaleDateString("fr-FR", { month: "short", timeZone: "Europe/Paris" })}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{s.step_title ?? "Séance de suivi"}</p>
                        <p className="text-sm text-muted first-letter:uppercase">{formatDate(s.starts_at, { weekday: "long", day: "numeric", month: "long" })} · {formatTime(s.starts_at)} · {s.duration_min} min</p>
                        <p className="text-sm">{s.practitioner_name} · <span className="text-muted">{s.location}</span></p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card title="Mon parcours" action={<span className="text-xs text-muted">{done}/{timeline.length} étapes</span>}>
            <Timeline steps={timeline} startDate={enrollment.start_date} audience="patient" />
          </Card>

          <Card title="Mon suivi de la semaine">
            {enrollment.status === "termine" ? null : (
              <form action={addCheckin} className="mb-5 grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="weekly_km">Kilomètres cette semaine</label>
                  <input id="weekly_km" name="weekly_km" type="number" min={0} max={400} step={0.5} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="pain">Douleur (0 à 10)</label>
                  <input id="pain" name="pain" type="number" min={0} max={10} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="fatigue">Fatigue (0 à 10)</label>
                  <input id="fatigue" name="fatigue" type="number" min={0} max={10} className="input" />
                </div>
                <div className="sm:col-span-3">
                  <label className="label" htmlFor="comment">Un commentaire pour votre équipe ?</label>
                  <input id="comment" name="comment" maxLength={500} className="input" placeholder="Sensations, gêne, imprévu…" />
                </div>
                <div className="sm:col-span-3">
                  <SubmitButton>Envoyer mon suivi</SubmitButton>
                  <p className="mt-2 text-xs text-muted">En cas de douleur forte ou de symptôme inquiétant, contactez directement votre médecin ou le 15.</p>
                </div>
              </form>
            )}
            <CheckinTable checkins={checkins} />
          </Card>
        </div>

        <aside className="space-y-6">
          <Card title="Conseils de mon équipe">
            {notes.length === 0 ? (
              <EmptyState>Pas encore de conseil.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-brand-soft/60 p-3">
                    <p className="text-sm">{n.body}</p>
                    <p className="mt-1.5 text-xs text-muted">{n.author_name} · {formatDate(n.created_at, { day: "numeric", month: "short" })}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Mon équipe de soins">
            <ul className="space-y-2.5">
              {team.map((m) => (
                <li key={m.id}>
                  <p className="text-sm font-medium">{fullName(m)}</p>
                  <ProfessionTag profession={m.profession} />
                </li>
              ))}
            </ul>
            <Link href="/patient/confidentialite" className="mt-4 inline-block text-sm text-brand hover:underline">
              Qui peut voir mes informations ? →
            </Link>
          </Card>
        </aside>
      </div>
    </div>
  );
}
