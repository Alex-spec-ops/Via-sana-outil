import { createShare, revokeShare, setSharingOpposition } from "@/app/actions";
import { requirePatient } from "@/lib/auth";
import { ALL_PROFESSIONS, INTAKE_SECTIONS, PROFESSION_LABEL, PROFESSION_SHORT, type Audience } from "@/lib/domain";
import { ACTION_LABEL, SELF_ACTION_LABEL, formatDate, formatDateTime, fullName } from "@/lib/format";
import { getPatientSpace } from "@/lib/queries";
import { Badge, Card, EmptyState, ProfessionTag } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const COLUMNS: { id: Audience; label: string }[] = [
  ...ALL_PROFESSIONS.map((p) => ({ id: p, label: PROFESSION_SHORT[p] })),
  { id: "coordinateur", label: "Coord." },
];

export default async function PrivacyPage() {
  const me = await requirePatient();
  const space = await getPatientSpace(me.id);
  if (!space) return <EmptyState>Aucun parcours n&apos;est associé à votre compte.</EmptyState>;
  const { enrollment, team, accessLogs, reports, shares } = space;
  const opposed = enrollment.sharing_opposed === 1;
  const accepted = team.filter((m) => m.status === "acceptee");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mes données et qui peut les voir</h1>
        <p className="text-sm text-muted">Vos informations de santé sont protégées par le secret médical. Voici comment elles circulent.</p>
      </div>

      <Card title="Qui fait quoi">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium">Votre équipe de soins</p>
            <p className="mt-1 text-sm text-muted">
              Les praticiens que vous avez acceptés. Ils voient les informations utiles à leur spécialité et partagent entre eux leurs
              comptes rendus.
            </p>
            <ul className="mt-3 space-y-2">
              {accepted.map((m) => (
                <li key={m.id}>
                  <p className="text-sm font-medium">{fullName(m)}</p>
                  <ProfessionTag profession={m.profession} />
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="font-medium">Votre coordinatrice · {enrollment.coordinator_name}</p>
            <p className="mt-1 text-sm text-muted">
              Via Sana n&apos;est pas un établissement de santé et ne dispense aucun soin. Votre coordinatrice organise vos rendez-vous
              et compose votre équipe avec vous, mais <strong>elle ne voit ni vos réponses de santé, ni les notes, ni les comptes rendus</strong>.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Ce que chacun voit de votre questionnaire">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted uppercase">
                <th className="px-5 py-2 font-medium">Section</th>
                {COLUMNS.map((c) => <th key={c.id} className="px-2 py-2 text-center font-medium">{c.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {INTAKE_SECTIONS.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2">{s.title}</td>
                  {COLUMNS.map((c) => (
                    <td key={c.id} className="px-2 py-2 text-center">
                      {s.audience.includes(c.id) ? <span className="font-semibold text-done">Oui</span> : <span className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted">
          {COLUMNS.map((c) => `${c.label} = ${c.id === "coordinateur" ? "coordination Via Sana" : PROFESSION_LABEL[c.id].toLowerCase()}`).join(" · ")}
        </p>
      </Card>

      <Card title="Partage entre mes praticiens">
        <p className="text-sm">
          {opposed ? (
            <>
              <strong>Vous vous êtes opposé·e au partage</strong>
              {enrollment.consent_updated_at && <> le {formatDate(enrollment.consent_updated_at)}</>}. Chaque praticien ne voit que ses
              propres notes et comptes rendus.
            </>
          ) : (
            <>
              Vos praticiens partagent entre eux les informations <strong>strictement nécessaires</strong> à la coordination de votre
              parcours. Vous pouvez vous y opposer à tout moment.
            </>
          )}
        </p>
        <form action={setSharingOpposition} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="opposed" value={opposed ? "0" : "1"} />
          <SubmitButton variant={opposed ? "primary" : "secondary"}>
            {opposed ? "Autoriser à nouveau le partage" : "M'opposer au partage entre praticiens"}
          </SubmitButton>
          {!opposed && <p className="text-xs text-muted">Sans partage, la coordination de votre parcours sera moins efficace.</p>}
        </form>
        <p className="mt-3 text-xs text-muted">Droit prévu à l&apos;article L1110-4 du code de la santé publique.</p>
      </Card>

      <section id="partages" className="scroll-mt-24">
        <Card title="Partager mon bilan hors de l'équipe">
          <p className="mb-4 text-sm text-muted">
            Votre médecin traitant ou votre kiné habituel ne font pas partie de votre équipe PrépaMarathon : leur transmettre votre bilan
            demande votre accord explicite. Ils reçoivent un lien que vous pouvez révoquer à tout moment.
          </p>
          {reports.length === 0 ? (
            <EmptyState>Votre bilan n&apos;a pas encore été remis.</EmptyState>
          ) : (
            <form action={createShare} className="grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
              <input type="hidden" name="reportId" value={reports[0].id} />
              <div>
                <label className="label" htmlFor="recipient_name">Nom du praticien</label>
                <input id="recipient_name" name="recipient_name" required maxLength={120} className="input" placeholder="Dr Durand" />
              </div>
              <div>
                <label className="label" htmlFor="recipient_role">Sa fonction</label>
                <input id="recipient_role" name="recipient_role" required maxLength={120} list="roles" className="input" placeholder="Médecin traitant" />
                <datalist id="roles">
                  <option value="Médecin traitant" />
                  <option value="Kinésithérapeute habituel" />
                </datalist>
              </div>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" name="consent" value="1" required className="mt-1" />
                J&apos;accepte que mon bilan de course soit transmis à ce praticien, qui ne fait pas partie de mon équipe de soins.
              </label>
              <div className="sm:col-span-2"><SubmitButton>Créer le lien de partage</SubmitButton></div>
            </form>
          )}
          {shares.length > 0 && (
            <ul className="mt-4 divide-y divide-border">
              {shares.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{s.recipient_name} <span className="font-normal text-muted">· {s.recipient_role}</span></p>
                    <p className="text-xs text-muted">
                      Accord donné le {formatDate(s.consent_at)}
                      {s.last_access_at && ` · ouvert le ${formatDate(s.last_access_at)}`}
                    </p>
                    {!s.revoked_at && (
                      <a href={`/partage/${s.token}`} className="mt-1 block font-mono text-xs break-all text-brand hover:underline">/partage/{s.token}</a>
                    )}
                  </div>
                  {s.revoked_at ? (
                    <Badge className="bg-upcoming-soft text-upcoming">Révoqué le {formatDate(s.revoked_at)}</Badge>
                  ) : (
                    <form action={revokeShare}>
                      <input type="hidden" name="shareId" value={s.id} />
                      <SubmitButton variant="secondary">Révoquer</SubmitButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      <Card title="Qui a consulté mon dossier">
        {accessLogs.length === 0 ? (
          <EmptyState>Aucun accès enregistré.</EmptyState>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {accessLogs.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <span className="font-medium">{l.actor_type === "patient" ? "Vous" : l.actor_name}</span>
                  {l.profession && <span className="text-muted"> ({PROFESSION_LABEL[l.profession].toLowerCase()})</span>}{" "}
                  {l.allowed
                    ? (l.actor_type === "patient" ? SELF_ACTION_LABEL : ACTION_LABEL)[l.action] ?? l.action
                    : <span className="text-danger">a tenté d&apos;accéder à une information non autorisée (refusé)</span>}
                </span>
                <span className="text-xs text-muted first-letter:uppercase">{formatDateTime(l.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Vos droits">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Accéder à vos informations, en obtenir une copie, les faire rectifier ou supprimer.</li>
          <li>Vous opposer au partage entre professionnels, et choisir qui entre dans votre équipe.</li>
          <li>Vos données sont hébergées chez un hébergeur certifié pour les données de santé (HDS), en Union européenne.*</li>
          <li>Elles ne sont jamais vendues ni utilisées à d&apos;autres fins que votre parcours.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">* Engagement de la version de production — ce prototype n&apos;utilise que des données fictives.</p>
      </Card>
    </div>
  );
}
