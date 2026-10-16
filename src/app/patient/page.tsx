import Link from "next/link";
import { redirect } from "next/navigation";
import { addCheckin, chooseNext, decideTeamMember } from "@/app/actions";
import { requirePatient } from "@/lib/auth";
import { COORDINATION_OFFER, PROFESSION_LABEL } from "@/lib/domain";
import { daysUntil, formatDate, formatTime, fullName } from "@/lib/format";
import { getPatientSpace } from "@/lib/queries";
import { Card, EmptyState, Notice, OfferBadge, ProfessionTag, ProgressBar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { CheckinTable } from "@/components/checkins";
import { SubmitButton } from "@/components/submit-button";

export default async function PatientHome({ searchParams }: PageProps<"/patient">) {
  const me = await requirePatient();
  const space = getPatientSpace(me.id);
  if (!space) return <EmptyState>Aucun parcours n&apos;est associé à votre compte.</EmptyState>;
  const { enrollment, timeline, sessions, notes, checkins, intake, team, reports } = space;
  const { formulaire } = await searchParams;
  // Nothing started yet: the questionnaire comes first.
  if (!intake && enrollment.status === "actif") redirect("/patient/formulaire");

  const now = new Date().toISOString();
  const upcoming = sessions.filter((s) => s.status === "prevue" && s.starts_at >= now);
  const done = timeline.filter((s) => s.status === "realisee").length;
  const total = timeline.filter((s) => s.status !== "non_retenue").length;
  const current = timeline.find((s) => s.status === "en_cours");
  const raceIn = daysUntil(enrollment.goal_date);
  const formSent = Boolean(intake?.submitted_at);
  const choosing = current?.title === "Choix de la suite";
  const proposals = team.filter((m) => m.status === "proposee");
  const accepted = team.filter((m) => m.status === "acceptee");

  return (
    <div className="space-y-6">
      {formulaire === "envoye" && (
        <Notice tone="done">Merci ! Votre questionnaire a bien été transmis : le kiné le lira avant votre bilan de course.</Notice>
      )}

      <section className="card overflow-hidden">
        <div className="bg-brand px-5 py-5 text-white">
          <p className="text-sm opacity-80">PrépaMarathon · {enrollment.offer === "parcours" ? "Parcours coordonné" : "Bilan de course"}</p>
          <h1 className="text-2xl font-semibold">{enrollment.goal_title}</h1>
          <p className="mt-1 text-sm opacity-90">
            {enrollment.goal_date && raceIn !== null && raceIn >= 0
              ? `Plus que ${raceIn} jours — rendez-vous le ${formatDate(enrollment.goal_date, { day: "numeric", month: "long" })}`
              : enrollment.goal_detail}
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="label">Votre progression</p>
            <ProgressBar done={done} total={total} />
          </div>
          <div>
            <p className="label">Étape en cours</p>
            <p className="font-medium">{current ? current.title : enrollment.status === "termine" ? "Parcours terminé" : "—"}</p>
            {enrollment.status === "en_pause" && <p className="text-sm text-current">Votre parcours est en pause. Votre coordinatrice vous recontactera.</p>}
          </div>
          <div>
            <p className="label">Votre coordinatrice</p>
            <p className="font-medium">{enrollment.coordinator_name}</p>
            <p className="text-sm text-muted">Elle organise vos rendez-vous et répond à vos questions pratiques.</p>
          </div>
        </div>
      </section>

      {!formSent && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-current/30 bg-current-soft px-4 py-3">
          <div>
            <p className="font-medium text-current">Première étape : votre questionnaire</p>
            <p className="text-sm text-current">5 minutes. Le kiné le lit avant de vous voir, pour passer directement aux examens le jour du bilan.</p>
          </div>
          <Link href="/patient/formulaire" className="btn btn-primary">Remplir mon questionnaire</Link>
        </div>
      )}

      {choosing && (
        <Card title="Votre bilan est terminé. Et maintenant ?">
          <p className="mb-4 text-sm text-muted">Votre plan d&apos;action est à vous, quel que soit votre choix.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <form action={chooseNext} className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <input type="hidden" name="choice" value="stop" />
              <p className="font-medium">M&apos;arrêter là</p>
              <p className="flex-1 text-sm text-muted">Je suis mon plan d&apos;action seul·e ou avec mes praticiens habituels, à qui je peux partager mon bilan.</p>
              <SubmitButton variant="secondary">Je m&apos;arrête au bilan</SubmitButton>
            </form>
            <form action={chooseNext} className="flex flex-col gap-3 rounded-xl border-2 border-brand p-4">
              <input type="hidden" name="choice" value="parcours" />
              <p className="font-medium">Continuer avec le parcours coordonné</p>
              <p className="flex-1 text-sm text-muted">
                Une équipe composée selon les besoins de mon bilan, des rendez-vous organisés pour moi, un dossier unique.
                Coordination : {COORDINATION_OFFER.price} pour {COORDINATION_OFFER.months} mois, hors honoraires des praticiens, sans reconduction.
              </p>
              <SubmitButton>Je continue</SubmitButton>
            </form>
          </div>
        </Card>
      )}

      {proposals.length > 0 && (
        <Card title="Votre coordinatrice propose d'élargir votre équipe">
          <p className="mb-3 text-sm text-muted">
            Ce praticien n&apos;aura accès à votre dossier que si vous l&apos;acceptez. Vous pouvez aussi refuser et en parler avec votre coordinatrice.
          </p>
          <ul className="space-y-3">
            {proposals.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div>
                  <p className="font-medium">{fullName(m)}</p>
                  <p className="text-sm text-muted">{PROFESSION_LABEL[m.profession]} · {m.specialty} · {m.location}</p>
                </div>
                <form action={decideTeamMember} className="flex gap-2">
                  <input type="hidden" name="practitionerId" value={m.id} />
                  <SubmitButton variant="secondary" name="decision" value="refusee">Refuser</SubmitButton>
                  <SubmitButton name="decision" value="acceptee">Accepter</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          {reports.length > 0 && (
            <Card title="Mon plan d'action">
              {reports.map((r) => (
                <div key={r.id} className="space-y-3">
                  <ol className="list-decimal space-y-1 pl-5 text-sm">
                    {r.action_plan.split("\n").filter(Boolean).map((l) => <li key={l}>{l}</li>)}
                  </ol>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/compte-rendu/${r.id}`} className="btn btn-primary">Mon bilan complet (PDF)</Link>
                    <Link href="/patient/confidentialite#partages" className="btn btn-secondary">Le partager avec un praticien</Link>
                    <span className="text-xs text-muted">{r.author_name} · {formatDate(r.published_at)}</span>
                  </div>
                </div>
              ))}
            </Card>
          )}

          <Card title="Mes prochaines séances">
            {upcoming.length === 0 ? (
              <EmptyState>Aucune séance planifiée pour le moment. Votre coordinatrice s&apos;en occupe.</EmptyState>
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

          <Card title="Mon parcours" action={<span className="text-xs text-muted">{done}/{total} étapes</span>}>
            <Timeline steps={timeline} startDate={enrollment.start_date} />
          </Card>

          {enrollment.offer === "parcours" && (
            <Card title="Mon suivi de la semaine">
              {enrollment.status === "actif" && (
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
                    <p className="mt-2 text-xs text-muted">Visible par vos praticiens uniquement. En cas de douleur forte ou de symptôme inquiétant, contactez votre médecin ou le 15.</p>
                  </div>
                </form>
              )}
              <CheckinTable checkins={checkins} />
            </Card>
          )}
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
              {accepted.map((m) => (
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

          <OfferCard offer={enrollment.offer} until={enrollment.coordinated_until} />
        </aside>
      </div>
    </div>
  );
}

function OfferCard({ offer, until }: { offer: "bilan" | "parcours"; until: string | null }) {
  return (
    <Card title="Mon offre">
      <OfferBadge offer={offer} />
      <p className="mt-2 text-sm text-muted">
        {offer === "parcours"
          ? `Coordination incluse jusqu'au ${formatDate(until)}. Vous réglez les praticiens directement, à leurs tarifs habituels.`
          : "Bilan de 30 minutes avec un kiné du sport, réglé au praticien et remboursable selon votre situation."}
      </p>
    </Card>
  );
}
