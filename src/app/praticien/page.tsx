import Link from "next/link";
import { requirePractitioner } from "@/lib/auth";
import { ENROLLMENT_STATUS_LABEL, PROFESSION_LABEL } from "@/lib/domain";
import { age, formatDate, formatDateTime } from "@/lib/format";
import {
  listPathwaySteps,
  listPathways,
  listPatientsForPractitioner,
  patientAlerts,
  upcomingSessionsForPractitioner,
} from "@/lib/queries";
import { Badge, Card, EmptyState, EnrollmentStatusBadge, ProgressBar } from "@/components/ui";

export default async function PatientsPage({ searchParams }: PageProps<"/praticien">) {
  const me = await requirePractitioner();
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const filters = { pathway: pick("parcours"), status: pick("statut"), step: pick("etape"), q: pick("q"), alert: pick("alerte") };

  const everyone = listPatientsForPractitioner(me.id);
  const patients = listPatientsForPractitioner(me.id, filters);
  const pathways = listPathways();
  const steps = listPathwaySteps(filters.pathway);
  const upcoming = upcomingSessionsForPractitioner(me.id);
  const activeFilters = Object.values(filters).some(Boolean);

  const stats = [
    { label: "Patients suivis", value: everyone.filter((p) => p.status !== "termine").length },
    { label: "Parcours actifs", value: everyone.filter((p) => p.status === "actif").length },
    { label: "À surveiller", value: everyone.filter((p) => patientAlerts(p).length > 0).length, href: "/praticien?alerte=1" },
    { label: "Mes séances à venir", value: upcoming.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bonjour {me.first_name}</h1>
        <p className="text-sm text-muted">
          Vous voyez uniquement les patients dont vous faites partie de l&apos;équipe de soins.
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
            <input name="q" defaultValue={filters.q} placeholder="Rechercher un patient…" className="input" aria-label="Rechercher" />
            <select name="parcours" defaultValue={filters.pathway ?? ""} className="input" aria-label="Parcours">
              <option value="">Tous les parcours</option>
              {pathways.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select name="statut" defaultValue={filters.status ?? ""} className="input" aria-label="Statut">
              <option value="">Tous les statuts</option>
              {Object.entries(ENROLLMENT_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <select name="etape" defaultValue={filters.step ?? ""} className="input" aria-label="Étape en cours">
              <option value="">Toutes les étapes</option>
              {pathways
                .filter((pw) => !filters.pathway || pw.id === filters.pathway)
                .map((pw) => (
                  <optgroup key={pw.id} label={pw.name}>
                    {steps.filter((s) => s.pathway_id === pw.id).map((s) => (
                      <option key={`${pw.id}:${s.position}`} value={`${pw.id}:${s.position}`}>
                        {s.position}. {s.title}
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>
            <div className="flex gap-2">
              <button className="btn btn-primary" type="submit">Filtrer</button>
              {activeFilters && <Link href="/praticien" className="btn btn-secondary">Effacer</Link>}
            </div>
          </form>

          {patients.length === 0 ? (
            <EmptyState>Aucun patient ne correspond à ces filtres.</EmptyState>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted uppercase">
                    <th className="px-5 py-2 font-medium">Patient</th>
                    <th className="px-3 py-2 font-medium">Parcours</th>
                    <th className="px-3 py-2 font-medium">Étape en cours</th>
                    <th className="px-3 py-2 font-medium">Progression</th>
                    <th className="px-3 py-2 font-medium">Prochaine séance</th>
                    <th className="px-5 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => {
                    const alerts = patientAlerts(p);
                    return (
                      <tr key={p.enrollment_id} className="border-b border-border last:border-0 hover:bg-background">
                        <td className="px-5 py-3">
                          <Link href={`/praticien/patients/${p.patient_id}`} className="font-medium text-brand hover:underline">
                            {p.first_name} {p.last_name}
                          </Link>
                          <p className="text-xs text-muted">{age(p.birth_date)} ans · {p.goal_title}</p>
                          {alerts.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {alerts.map((a) => (
                                <Badge key={a} className="bg-danger-soft text-danger">{a}</Badge>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">{p.pathway_name}</td>
                        <td className="px-3 py-3">
                          {p.current_step_title ? (
                            <>
                              <p>{p.current_step_position}. {p.current_step_title}</p>
                              {p.current_step_profession && (
                                <p className="text-xs text-muted">{PROFESSION_LABEL[p.current_step_profession]}</p>
                              )}
                            </>
                          ) : (
                            <span className="text-muted">Parcours terminé</span>
                          )}
                        </td>
                        <td className="px-3 py-3"><ProgressBar done={p.done_steps} total={p.total_steps} /></td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {p.next_session_at ? formatDate(p.next_session_at, { day: "numeric", month: "short" }) : <span className="text-muted">—</span>}
                        </td>
                        <td className="px-5 py-3"><EnrollmentStatusBadge status={p.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Mes prochaines séances">
          {upcoming.length === 0 ? (
            <EmptyState>Aucune séance planifiée.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {upcoming.map((s) => (
                <li key={s.id} className="border-l-2 border-brand pl-3">
                  <p className="text-sm font-medium first-letter:uppercase">{formatDateTime(s.starts_at)}</p>
                  <Link href={`/praticien/patients/${s.patient_id}`} className="text-sm text-brand hover:underline">
                    {s.first_name} {s.last_name}
                  </Link>
                  <p className="text-xs text-muted">{s.step_title ?? "Séance de suivi"} · {s.duration_min} min</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
