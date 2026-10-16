import { setSharingOpposition } from "@/app/actions";
import { requirePatient } from "@/lib/auth";
import { INTAKE_SECTIONS, PROFESSION_LABEL } from "@/lib/domain";
import { ACTION_LABEL, SELF_ACTION_LABEL, formatDate, formatDateTime, fullName } from "@/lib/format";
import { getPatientSpace } from "@/lib/queries";
import { Card, EmptyState, ProfessionTag } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function PrivacyPage() {
  const me = await requirePatient();
  const space = getPatientSpace(me.id);
  if (!space) return <EmptyState>Aucun parcours n&apos;est associé à votre compte.</EmptyState>;
  const { enrollment, team, accessLogs } = space;
  const opposed = enrollment.sharing_opposed === 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mes données et qui peut les voir</h1>
        <p className="text-sm text-muted">Vos informations de santé sont protégées par le secret médical. Voici comment elles sont utilisées.</p>
      </div>

      <Card title="Mon équipe de soins">
        <p className="mb-3 text-sm text-muted">
          Seuls ces professionnels, qui participent directement à votre parcours, peuvent ouvrir votre dossier. Aucun autre
          praticien du centre n&apos;y a accès.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {team.map((m) => (
            <li key={m.id} className="rounded-lg border border-border p-3">
              <p className="text-sm font-medium">{fullName(m)}</p>
              <ProfessionTag profession={m.profession} />
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Ce que chaque praticien voit de mon formulaire">
        <div className="-mx-5 overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted uppercase">
                <th className="px-5 py-2 font-medium">Section</th>
                {(["medecin", "kine", "osteo", "dieteticien"] as const).map((p) => (
                  <th key={p} className="px-3 py-2 text-center font-medium">{PROFESSION_LABEL[p].split(" ")[0]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {INTAKE_SECTIONS.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="px-5 py-2">{s.title}</td>
                  {(["medecin", "kine", "osteo", "dieteticien"] as const).map((p) => (
                    <td key={p} className="px-3 py-2 text-center">
                      {s.audience.includes(p) ? <span className="text-done" aria-label="visible">●</span> : <span className="text-border" aria-label="non visible">○</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Partage d'informations entre mes praticiens">
        <p className="text-sm">
          {opposed ? (
            <>
              <strong>Vous vous êtes opposé·e au partage</strong>
              {enrollment.consent_updated_at && <> le {formatDate(enrollment.consent_updated_at)}</>}. Chaque praticien ne
              voit que ses propres notes ; ils ne peuvent pas échanger leurs observations dans l&apos;outil.
            </>
          ) : (
            <>
              Vos praticiens partagent entre eux les informations <strong>strictement nécessaires</strong> à la coordination de
              votre parcours (notes de suivi, comptes rendus). Vous pouvez vous y opposer à tout moment.
            </>
          )}
        </p>
        <form action={setSharingOpposition} className="mt-4 flex flex-wrap items-center gap-3">
          <input type="hidden" name="opposed" value={opposed ? "0" : "1"} />
          <SubmitButton variant={opposed ? "primary" : "secondary"}>
            {opposed ? "Autoriser à nouveau le partage" : "M'opposer au partage entre praticiens"}
          </SubmitButton>
          {!opposed && (
            <p className="text-xs text-muted">Attention : sans partage, la coordination de votre parcours sera moins efficace.</p>
          )}
        </form>
        <p className="mt-3 text-xs text-muted">Droit prévu à l&apos;article L1110-4 du code de la santé publique.</p>
      </Card>

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
                  {l.allowed ? (l.actor_type === "patient" ? SELF_ACTION_LABEL : ACTION_LABEL)[l.action] ?? l.action : <span className="text-danger">a tenté d&apos;accéder au dossier (refusé)</span>}
                </span>
                <span className="text-xs text-muted first-letter:uppercase">{formatDateTime(l.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="Vos droits">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Accéder à vos informations et en obtenir une copie, les faire rectifier.</li>
          <li>Vous opposer au partage entre professionnels (ci-dessus).</li>
          <li>Vos données sont hébergées chez un hébergeur certifié pour les données de santé (HDS), en Union européenne.*</li>
          <li>Elles ne sont jamais vendues ni utilisées à d&apos;autres fins que votre prise en charge.</li>
        </ul>
        <p className="mt-3 text-xs text-muted">* Engagement de la version de production — ce prototype n&apos;utilise que des données fictives.</p>
      </Card>
    </div>
  );
}
