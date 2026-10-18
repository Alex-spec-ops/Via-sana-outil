import Link from "next/link";
import { requirePractitioner } from "@/lib/auth";
import { ENROLLMENT_STATUS_LABEL, OFFER_LABEL, PROFESSION_LABEL } from "@/lib/domain";
import { age, formatDate } from "@/lib/format";
import { clinicalAlerts, listPathways, listPatientsForPractitioner, upcomingSessionsForPractitioner } from "@/lib/queries";
import { Badge, Card, EmptyState, EnrollmentStatusBadge, OfferBadge, ProgressBar } from "@/components/ui";
import { AgendaList } from "@/components/agenda-list";
import { FilterForm } from "@/components/filter-form";
import { WorkQueue, type QueueItem } from "@/components/work-queue";

export default async function PatientsPage({ searchParams }: PageProps<"/praticien">) {
  const me = await requirePractitioner();
  const params = await searchParams;
  const pick = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  const filters = { pathway: pick("parcours"), offer: pick("offre"), status: pick("statut"), step: pick("etape"), q: pick("q"), alert: pick("alerte") };

  const everyone = await listPatientsForPractitioner(me.id);
  const patients = await listPatientsForPractitioner(me.id, filters);
  const pathways = await listPathways();
  const upcoming = await upcomingSessionsForPractitioner(me.id);
  const stepTitles = [...new Set(everyone.map((r) => r.current_step_title).filter(Boolean))] as string[];
  const activeFilters = Object.values(filters).some(Boolean);

  // What needs this practitioner, most urgent first: pain reported, report to hand over, their step in progress.
  const queue: QueueItem[] = everyone
    .filter((p) => p.status === "actif")
    .map((p) => {
      const tasks: QueueItem["tasks"] = [];
      let anchor = "parcours";
      if (p.last_pain !== null && p.last_pain >= 5) {
        tasks.push({ label: `Douleur déclarée ${p.last_pain}/10`, tone: "danger" });
        anchor = "suivi";
      }
      if (p.is_referent === 1 && p.plan_pending > 0) {
        tasks.push({ label: "Compte rendu à remettre", tone: "ongoing" });
        if (anchor === "parcours") anchor = "compte-rendu";
      }
      if (p.current_step_profession === me.profession && p.current_step_title !== "Plan d'action remis") {
        tasks.push({ label: `${p.current_step_title}${p.current_step_has_session ? "" : " · séance à fixer"}`, tone: "ongoing" });
      }
      return { key: p.enrollment_id, href: `/praticien/patients/${p.patient_id}#${anchor}`, who: `${p.first_name} ${p.last_name}`, detail: p.goal_title, tasks };
    })
    .filter((item) => item.tasks.length > 0)
    .sort((a, b) => Number(b.tasks.some((t) => t.tone === "danger")) - Number(a.tasks.some((t) => t.tone === "danger")) || b.tasks.length - a.tasks.length);

  const stats = [
    { label: "Patients suivis", value: everyone.filter((p) => p.status !== "termine").length },
    { label: "Dont parcours coordonnés", value: everyone.filter((p) => p.offer === "parcours" && p.status !== "termine").length },
    { label: "À surveiller", value: everyone.filter((p) => clinicalAlerts(p).length > 0).length, href: "/praticien?alerte=1" },
    { label: "Mes séances à venir", value: upcoming.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl">Bonjour <span className="accent-serif">{me.first_name}</span></h1>
        <p className="text-sm text-muted">Vous voyez uniquement les patients qui vous ont accepté dans leur équipe de soins.</p>
      </div>

      <WorkQueue items={queue} emptyText="Rien d'urgent : aucun signal ni compte rendu en attente." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s, i) => {
          // Coloured key figures, as on prepamarathon.com.
          const tone = ["bg-accent text-ecru", "bg-brand text-ecru", "bg-azurin text-brand", "bg-surface text-foreground border border-border"][i % 4];
          const content = (
            <>
              <p className="font-display text-4xl font-bold tabular-nums">{s.value}</p>
              <p className="mt-1 text-sm opacity-85">{s.label}</p>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className={`rounded-[20px] px-5 py-4 transition hover:-translate-y-0.5 ${tone}`}>{content}</Link>
          ) : (
            <div key={s.label} className={`rounded-[20px] px-5 py-4 ${tone}`}>{content}</div>
          );
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
        <Card className="min-w-0">
          <FilterForm className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[1.2fr_1.1fr_1fr_1fr_1.2fr_auto]">
            <input name="q" defaultValue={filters.q} placeholder="Rechercher un patient…" className="input" aria-label="Rechercher" />
            <select name="parcours" defaultValue={filters.pathway ?? ""} className="input" aria-label="Parcours">
              <option value="">Tous les parcours</option>
              {pathways.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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
              <button className="btn btn-primary" type="submit">Rechercher</button>
              {activeFilters && <Link href="/praticien" className="btn btn-secondary">Effacer</Link>}
            </div>
          </FilterForm>

          {patients.length === 0 ? (
            <EmptyState>Aucun patient ne correspond à ces filtres.</EmptyState>
          ) : (
            <div className="-mx-5 overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted uppercase">
                    <th className="px-5 py-2 font-medium">Patient</th>
                    <th className="px-3 py-2 font-medium">Parcours · offre</th>
                    <th className="px-3 py-2 font-medium">Étape en cours</th>
                    <th className="px-3 py-2 font-medium">Progression</th>
                    <th className="px-3 py-2 font-medium">Prochaine séance</th>
                    <th className="px-5 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => {
                    const alerts = clinicalAlerts(p);
                    return (
                      <tr key={p.enrollment_id} className="relative border-b border-border align-top last:border-0 hover:bg-background">
                        <td className="px-5 py-3">
                          <Link href={`/praticien/patients/${p.patient_id}`} className="font-medium text-brand after:absolute after:inset-0 hover:underline">
                            {p.first_name} {p.last_name}
                          </Link>
                          <p className="text-xs text-muted">{age(p.birth_date)} ans · {p.goal_title}</p>
                          {alerts.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {alerts.map((a) => <Badge key={a} className="bg-danger-soft text-danger">{a}</Badge>)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <p className="mb-1 text-xs text-muted">{p.pathway_name}</p>
                          <OfferBadge offer={p.offer} />
                        </td>
                        <td className="px-3 py-3">
                          {p.current_step_title ? (
                            <>
                              <p>{p.current_step_title}</p>
                              {p.current_step_profession && <p className="text-xs text-muted">{PROFESSION_LABEL[p.current_step_profession]}</p>}
                            </>
                          ) : (
                            <span className="text-muted">Terminé</span>
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
          <AgendaList
            items={upcoming.map((s) => ({
              id: s.id, starts_at: s.starts_at, duration_min: s.duration_min, href: `/praticien/patients/${s.patient_id}`,
              who: `${s.first_name} ${s.last_name}`, what: s.step_title ?? "Séance de suivi",
            }))}
          />
        </Card>
      </div>
    </div>
  );
}
