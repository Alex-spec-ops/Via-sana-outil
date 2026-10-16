import { redirect } from "next/navigation";
import { loginAs, resetDemo } from "./actions";
import { getSession } from "@/lib/auth";
import { listPersonas } from "@/lib/queries";
import { PROFESSION_LABEL } from "@/lib/domain";
import { fullName, initials } from "@/lib/format";
import { EnrollmentStatusBadge, OfferBadge } from "@/components/ui";

const HOME = { practitioner: "/praticien", patient: "/patient", coordinator: "/coordination" } as const;

function PersonaButton({ type, id, children }: { type: string; id: string; children: React.ReactNode }) {
  return (
    <form action={loginAs}>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-brand">
        {children}
      </button>
    </form>
  );
}

export default async function Home() {
  const session = await getSession();
  if (session) redirect(HOME[session.type]);

  const { coordinators, practitioners, patients } = listPersonas();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">VS</span>
        <div>
          <h1 className="text-2xl font-semibold">Via Sana · PrépaMarathon</h1>
          <p className="text-sm text-muted">Outil de coordination du parcours — prototype. Choisissez un profil fictif.</p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand">
        <strong>Mode démonstration.</strong> En production, l&apos;accès praticien passe par une authentification forte
        (Pro Santé Connect / e-CPS), l&apos;accès coordination et patient par un identifiant personnel avec double facteur.
        Les droits d&apos;accès affichés ensuite, eux, sont ceux de la version réelle.
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Coordination Via Sana</h2>
          <ul className="space-y-2">
            {coordinators.map((c) => (
              <li key={c.id}>
                <PersonaButton type="coordinator" id={c.id}>
                  <span className="flex size-10 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold text-white">{initials(c)}</span>
                  <span className="flex-1">
                    <span className="block font-medium">{c.first_name} {c.last_name}</span>
                    <span className="block text-sm text-muted">Coordinatrice · organise, relance, suit</span>
                  </span>
                  <span className="text-xs text-muted">{c.patient_count} parcours</span>
                </PersonaButton>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Via Sana n&apos;est pas un établissement de santé : la coordination voit l&apos;organisation du parcours, jamais le contenu clinique.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Praticiens partenaires</h2>
          <ul className="space-y-2">
            {practitioners.map((p) => (
              <li key={p.id}>
                <PersonaButton type="practitioner" id={p.id}>
                  <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">{initials(p)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{fullName(p)}</span>
                    <span className="block truncate text-sm text-muted">{PROFESSION_LABEL[p.profession]} · {p.specialty}</span>
                  </span>
                  <span className="text-xs text-muted">{p.patient_count}</span>
                </PersonaButton>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Coureurs (patients)</h2>
          <ul className="space-y-2">
            {patients.map((p) => (
              <li key={p.id}>
                <PersonaButton type="patient" id={p.id}>
                  <span className="flex size-10 items-center justify-center rounded-full bg-upcoming-soft text-sm font-semibold text-upcoming">{initials(p)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{p.first_name} {p.last_name}</span>
                    <span className="block truncate text-sm text-muted">{p.goal_title}</span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <OfferBadge offer={p.offer} />
                    {p.status !== "actif" && <EnrollmentStatusBadge status={p.status} />}
                  </span>
                </PersonaButton>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
        <p>Inspiré de l&apos;offre PrépaMarathon (prepamarathon.com). Toutes les personnes et données sont fictives.</p>
        <form action={resetDemo}>
          <button type="submit" className="btn btn-secondary text-xs">Réinitialiser les données de démo</button>
        </form>
      </footer>
    </main>
  );
}
