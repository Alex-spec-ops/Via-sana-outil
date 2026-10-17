import Link from "next/link";
import { redirect } from "next/navigation";
import { chooseNext, decideTeamMember } from "@/app/actions";
import { requirePatient } from "@/lib/auth";
import { COORDINATION_OFFER, PROFESSION_LABEL } from "@/lib/domain";
import { daysUntil, formatDate, formatTime, fullName } from "@/lib/format";
import { getPatientSpace, type SessionRow } from "@/lib/queries";
import { Card, EmptyState, Notice, OfferBadge, ProfessionTag, ProgressBar } from "@/components/ui";
import { Timeline } from "@/components/timeline";
import { CheckinTable } from "@/components/checkins";
import { CheckinForm } from "@/components/checkin-form";
import { SubmitButton } from "@/components/submit-button";

const WEEK = 7 * 24 * 60 * 60 * 1000;

export default async function PatientHome({ searchParams }: PageProps<"/patient">) {
  const me = await requirePatient();
  const space = await getPatientSpace(me.id);
  if (!space) return <EmptyState>Aucun parcours n&apos;est associé à votre compte.</EmptyState>;
  const { enrollment, timeline, sessions, notes, checkins, intake, team, reports } = space;
  const { formulaire, suivi } = await searchParams;
  // Nothing started yet: the questionnaire comes first.
  if (!intake && enrollment.status === "actif") redirect("/patient/formulaire");

  const now = new Date();
  const upcoming = sessions.filter((s) => s.status === "prevue" && s.starts_at >= now.toISOString());
  const next = upcoming[0];
  const done = timeline.filter((s) => s.status === "realisee").length;
  const total = timeline.filter((s) => s.status !== "non_retenue").length;
  const current = timeline.find((s) => s.status === "en_cours");
  const raceIn = daysUntil(enrollment.goal_date);
  const active = enrollment.status === "actif";
  const formSent = Boolean(intake?.submitted_at);
  const choosing = current?.title === "Choix de la suite";
  const proposals = team.filter((m) => m.status === "proposee");
  const accepted = team.filter((m) => m.status === "acceptee");
  const lastOwnCheckin = checkins.find((c) => c.author_type === "patient");
  const checkinDue =
    enrollment.offer === "parcours" && active && (!lastOwnCheckin || now.getTime() - new Date(lastOwnCheckin.date).getTime() > WEEK - 24 * 60 * 60 * 1000);
  const todoCount = [!formSent, choosing, proposals.length > 0, checkinDue].filter(Boolean).length;
  const coordinatorFirstName = enrollment.coordinator_name.split(" ")[0];

  return (
    <div className="space-y-6">
      {formulaire === "envoye" && (
        <Notice tone="done">Merci ! Votre questionnaire a bien été transmis : le kiné le lira avant votre bilan de course.</Notice>
      )}

      <section className="card overflow-hidden">
        <div className="bg-brand px-5 py-5 text-white">
          <span className="eyebrow">{enrollment.offer === "parcours" ? "Parcours coordonné" : "Bilan de course"}</span>
          <h1 className="mt-3 text-3xl">{enrollment.goal_title}</h1>
          {enrollment.goal_date && raceIn !== null && raceIn >= 0 ? (
            <p className="mt-1 text-sm opacity-90">
              <span className="accent-serif text-lg text-[#f6a588]">Plus que {raceIn} jours.</span>{" "}
              <span className="opacity-90">Rendez-vous le {formatDate(enrollment.goal_date, { day: "numeric", month: "long" })}</span>
            </p>
          ) : (
            enrollment.goal_detail && <p className="mt-1 text-sm opacity-90">{enrollment.goal_detail}</p>
          )}
          {next && (
            <p className="mt-4 inline-flex flex-wrap items-center gap-x-2 rounded-lg bg-white/15 px-3 py-2 text-sm">
              <span className="opacity-80">Prochain rendez-vous</span>
              <span className="font-medium first-letter:uppercase">
                {formatDate(next.starts_at, { weekday: "long", day: "numeric", month: "long" })} à {formatTime(next.starts_at)}
              </span>
              <span className="opacity-80">avec {next.practitioner_name}</span>
            </p>
          )}
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <div>
            <p className="label">Votre progression</p>
            <ProgressBar done={done} total={total} />
          </div>
          <div>
            <p className="label">Étape en cours</p>
            <p className="font-medium">{current ? current.title : enrollment.status === "termine" ? "Parcours terminé" : "—"}</p>
            {enrollment.status === "en_pause" && <p className="text-sm text-ongoing">Votre parcours est en pause. Votre coordinatrice vous recontactera.</p>}
          </div>
          <div>
            <p className="label">Votre coordinatrice</p>
            <p className="font-medium">{enrollment.coordinator_name}</p>
            <p className="text-sm text-muted">Rendez-vous, organisation, questions pratiques.</p>
            <a
              href={`mailto:${enrollment.coordinator_email}?subject=${encodeURIComponent("Question sur mon parcours PrépaMarathon")}`}
              className="mt-1 inline-block text-sm font-medium text-brand hover:underline"
            >
              Écrire à {coordinatorFirstName} →
            </a>
          </div>
        </div>
      </section>

      {todoCount > 0 && (
        <section aria-labelledby="todo" className="space-y-3">
          <h2 id="todo" className="flex items-center gap-2 text-base font-semibold">
            À faire
            <span className="rounded-full bg-ongoing px-2 py-0.5 text-xs text-white tabular-nums">{todoCount}</span>
          </h2>

          {!formSent && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ongoing/30 bg-ongoing-soft px-4 py-3">
              <div>
                <p className="font-medium text-ongoing">Votre questionnaire de bilan</p>
                <p className="text-sm text-ongoing">5 minutes. Le kiné le lit avant de vous voir, pour passer directement aux examens le jour du bilan.</p>
              </div>
              <Link href="/patient/formulaire" className="btn btn-primary">{intake ? "Reprendre mon questionnaire" : "Remplir mon questionnaire"}</Link>
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
                  <ul className="flex-1 space-y-1 text-sm text-muted">
                    <li>✓ une équipe composée selon les besoins de mon bilan</li>
                    <li>✓ des rendez-vous organisés pour moi</li>
                    <li>✓ un dossier unique, partagé avec mon accord</li>
                  </ul>
                  <p className="text-sm">
                    <span className="font-semibold">{COORDINATION_OFFER.price}</span>{" "}
                    <span className="text-muted">pour {COORDINATION_OFFER.months} mois de coordination, hors honoraires des praticiens, sans reconduction.</span>
                  </p>
                  <SubmitButton>Je continue</SubmitButton>
                </form>
              </div>
            </Card>
          )}

          {proposals.length > 0 && (
            <Card title={proposals.length > 1 ? "Votre coordinatrice propose d'élargir votre équipe" : "Votre coordinatrice vous propose un praticien"}>
              <p className="mb-3 text-sm text-muted">
                Un praticien n&apos;a accès à votre dossier que si vous l&apos;acceptez. En cas de doute, refusez et parlez-en avec {coordinatorFirstName}.
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

          {checkinDue && (
            <a href="#suivi" className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition hover:border-brand">
              <span>
                <span className="block font-medium">Votre suivi de la semaine</span>
                <span className="block text-sm text-muted">
                  Kilomètres, douleur, fatigue : 30 secondes pour que votre équipe ajuste votre préparation.
                  {lastOwnCheckin && ` Dernier envoi le ${formatDate(lastOwnCheckin.date, { day: "numeric", month: "long" })}.`}
                </span>
              </span>
              <span className="text-brand" aria-hidden>↓</span>
            </a>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
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
                  </div>
                  <p className="text-xs text-muted">Rédigé par {r.author_name} · {formatDate(r.published_at)}</p>
                </div>
              ))}
            </Card>
          )}

          <Card title="Mes prochaines séances">
            {upcoming.length === 0 ? (
              <EmptyState>
                {active ? `Aucune séance planifiée pour le moment : ${coordinatorFirstName} s'en occupe et vous préviendra.` : "Aucune séance à venir."}
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((s) => <SessionItem key={s.id} session={s} />)}
              </ul>
            )}
          </Card>

          <Card title="Mon parcours" action={<span className="text-xs text-muted">{done}/{total} étapes</span>}>
            <Timeline steps={timeline} startDate={enrollment.start_date} collapseFinished />
          </Card>

          {enrollment.offer === "parcours" && (
            <section id="suivi" className="scroll-mt-[calc(var(--header-h,90px)+1rem)]">
              <Card title="Mon suivi de la semaine">
                {suivi === "envoye" && (
                  <div className="mb-4">
                    <Notice tone="done">C&apos;est envoyé, merci ! Votre équipe le verra avant votre prochaine séance.</Notice>
                  </div>
                )}
                {active && (checkinDue ? (
                  <div className="mb-6"><CheckinForm /></div>
                ) : (
                  <details className="mb-5">
                    <summary className="cursor-pointer text-sm text-brand hover:underline">
                      Suivi de la semaine envoyé ✓ — en ajouter un autre
                    </summary>
                    <div className="mt-4"><CheckinForm /></div>
                  </details>
                ))}
                <h3 className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Mes semaines précédentes</h3>
                <CheckinTable checkins={checkins} />
              </Card>
            </section>
          )}
        </div>

        <aside className="min-w-0 space-y-6">
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
                  <p className="text-sm font-medium">
                    {fullName(m)}
                    {m.is_referent === 1 && <span className="ml-1.5 text-xs font-normal text-muted">· référent</span>}
                  </p>
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

function SessionItem({ session: s }: { session: SessionRow }) {
  const d = new Date(s.starts_at);
  return (
    <li className="flex gap-4 rounded-lg border border-border p-3">
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-lg bg-brand-soft py-1.5 text-brand">
        <span className="text-xl leading-none font-semibold">{d.toLocaleDateString("fr-FR", { day: "numeric", timeZone: "Europe/Paris" })}</span>
        <span className="text-xs uppercase">{d.toLocaleDateString("fr-FR", { month: "short", timeZone: "Europe/Paris" })}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{s.step_title ?? "Séance de suivi"}</p>
        <p className="text-sm text-muted first-letter:uppercase">
          {formatDate(s.starts_at, { weekday: "long", day: "numeric", month: "long" })} · {formatTime(s.starts_at)} · {s.duration_min} min
        </p>
        <p className="text-sm">{s.practitioner_name} · <span className="text-muted">{s.location}</span></p>
        <a href={`/patient/seances/${s.id}/agenda.ics`} className="mt-1.5 inline-block text-sm font-medium text-brand hover:underline">
          Ajouter à mon agenda
        </a>
      </div>
    </li>
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
