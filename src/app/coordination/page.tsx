import Link from "next/link";
import { requireCoordinator } from "@/lib/auth";
import { ENROLLMENT_STATUS_LABEL, OFFER_LABEL, PROFESSION_LABEL } from "@/lib/domain";
import { formatDate, formatDateTime } from "@/lib/format";
import { coordinationTodos, listForCoordinator, upcomingSessionsForCoordinator } from "@/lib/queries";
import { Badge, Card, EmptyState, EnrollmentStatusBadge, OfferBadge, ProgressBar } from "@/components/ui";

export default async function CoordinationPage({ searchParams }: PageProps<"/coordination">) {
  const me = await requireCoordinator();
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const filters = { offer: pick("offre"), status: pick("statut"), step: pick("etape"), q: pick("q"), alert: pick("afaire") };

  const everyone = await listForCoordinator(me.id);
  const rows = await listForCoordinator(me.id, filters);
  const upcoming = await upcomingSessionsForCoordinator(me.id);
  const stepTitles = [...new Set(everyone.map((r) => r.current_step_title).filter(Boolean))] as string[];
  const activeFilters = Object.values(filters).some(Boolean);

  const stats = [
    { label: "Bilans de course en cours", value: everyone.filter((r) => r.offer === "bilan" && r.status === "actif").length, href: "/coordination?offre=bilan&statut=actif" },
    { label: "Parcours coordonnés actifs", value: everyone.filter((r) => r.offer === "parcours" && r.status === "actif").length, href: "/coordination?offre=parcours&statut=actif" },
    { label: "Patients avec une action à faire", value: everyone.filter((r) => coordinationTodos(r).length > 0).length, href: "/coordination?afaire=1" },
    { label: "Séances planifiées à venir", value: upcoming.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour {me.first_name}</h1>
        <p className="text-sm text-muted">
          Vous organisez les parcours : questionnaires, rendez-vous, composition des équipes, relances. Le contenu clinique reste entre
          le patient et ses praticiens.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => {
          const content = (
            <>
              <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
              <p className="text-sm text-muted">{s.label}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="card p-4 transition hover:border-brand">{content}</Link>
          ) : (
            <div key={s.label} className="card p-4">{content}</div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0">
          <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.3fr_auto]" method="get">
            <input name="q" defaultValue={filters.q} placeholder="Rechercher…" className="input" aria-label="Rechercher" />
            <select name="offre" defaultValue={filters.offer ?? ""} className="input" aria-label="Offre">
              <option value="">Toutes les offres</option>
              {Object.entries(OFFER_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select name="statut" defaultValue={filters.status ?? ""} className="input" aria-label="Statut">
              <option value="">Tous les statuts</option>
              {Object.entries(ENROLLMENT_STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select name="etape" defaultValue={filters.step ?? ""} className="input" aria-label="Étape en cours">
              <option value="">Toutes les étapes</option>
              {stepTitles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">Filtrer</button>
              {activeFilters && <Link href="/coordination" className="btn btn-secondary">Effacer</Link>}
            </div>
          </form>

          {rows.length === 0 ? (
            <EmptyState>Aucun parcours ne correspond à ces filtres.</EmptyState>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted uppercase">
                    <th className="px-5 py-2 font-medium">Patient</th>
                    <th className="px-3 py-2 font-medium">Offre</th>
                    <th className="px-3 py-2 font-medium">Étape en cours</th>
                    <th className="px-3 py-2 font-medium">Avancement</th>
                    <th className="px-3 py-2 font-medium">Prochaine séance</th>
                    <th className="px-5 py-2 font-medium">À faire</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const todos = coordinationTodos(r);
                    return (
                      <tr key={r.enrollment_id} className="border-b border-border align-top last:border-0 hover:bg-background">
                        <td className="px-5 py-3">
                          <Link href={`/coordination/patients/${r.patient_id}`} className="font-medium text-brand hover:underline">
                            {r.first_name} {r.last_name}
                          </Link>
                          <p className="text-xs text-muted">{r.goal_title}</p>
                          {r.status !== "actif" && <div className="mt-1"><EnrollmentStatusBadge status={r.status} /></div>}
                        </td>
                        <td className="px-3 py-3"><OfferBadge offer={r.offer} /></td>
                        <td className="px-3 py-3">
                          {r.current_step_title ? (
                            <>
                              <p>{r.current_step_title}</p>
                              {r.current_step_profession && <p className="text-xs text-muted">{PROFESSION_LABEL[r.current_step_profession]}</p>}
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3"><ProgressBar done={r.done_steps} total={r.total_steps} /></td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {r.next_session_at ? formatDate(r.next_session_at, { day: "numeric", month: "short" }) : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-start gap-1">
                            {todos.length === 0 ? <span className="text-xs text-muted">Rien à faire</span> : todos.map((t) => (
                              <Badge key={t} className="bg-current-soft text-current">{t}</Badge>
                            ))}
                            {r.last_relance_at && <span className="text-xs text-muted">Relancé le {formatDate(r.last_relance_at, { day: "numeric", month: "short" })}</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Agenda du réseau">
          {upcoming.length === 0 ? (
            <EmptyState>Aucune séance planifiée.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((s) => (
                <li key={s.id} className="border-l-2 border-brand pl-3">
                  <p className="text-sm font-medium first-letter:uppercase">{formatDateTime(s.starts_at)}</p>
                  <Link href={`/coordination/patients/${s.patient_id}`} className="text-sm text-brand hover:underline">
                    {s.first_name} {s.last_name}
                  </Link>
                  <p className="text-xs text-muted">{s.step_title ?? "Séance"} · {s.practitioner_name}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
