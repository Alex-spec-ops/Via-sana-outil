import { redirect } from "next/navigation";
import { loginAs, resetDemo } from "./actions";
import { getSession } from "@/lib/auth";
import { listPersonas } from "@/lib/queries";
import { PROFESSION_LABEL } from "@/lib/domain";
import { initials } from "@/lib/format";
import { EnrollmentStatusBadge } from "@/components/ui";

export default async function Home() {
  const session = await getSession();
  if (session) redirect(session.type === "practitioner" ? "/praticien" : "/patient");

  const { practitioners, patients } = listPersonas();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-brand text-lg font-bold text-white">VS</span>
        <div>
          <h1 className="text-2xl font-semibold">Via Sana · Parcours de soins coordonnés</h1>
          <p className="text-sm text-muted">Prototype — choisissez un profil fictif pour explorer l&apos;outil.</p>
        </div>
      </div>

      <div className="mb-8 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand">
        <strong>Mode démonstration.</strong> En production, l&apos;accès praticien passe par une authentification forte
        (Pro Santé Connect / e-CPS) et l&apos;accès patient par un identifiant personnel avec double facteur.
        Les droits d&apos;accès affichés ensuite, eux, sont ceux de la version réelle.
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Espace praticien</h2>
          <ul className="space-y-2">
            {practitioners.map((p) => (
              <li key={p.id}>
                <form action={loginAs}>
                  <input type="hidden" name="type" value="practitioner" />
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-brand">
                    <span className="flex size-10 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                      {initials(p)}
                    </span>
                    <span className="flex-1">
                      <span className="block font-medium">{[p.title, p.first_name, p.last_name].filter(Boolean).join(" ")}</span>
                      <span className="block text-sm text-muted">{PROFESSION_LABEL[p.profession]}</span>
                    </span>
                    <span className="text-xs text-muted">{p.patient_count} patient{p.patient_count > 1 ? "s" : ""}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">Espace patient</h2>
          <ul className="space-y-2">
            {patients.map((p) => (
              <li key={p.id}>
                <form action={loginAs}>
                  <input type="hidden" name="type" value="patient" />
                  <input type="hidden" name="id" value={p.id} />
                  <button type="submit" className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-brand">
                    <span className="flex size-10 items-center justify-center rounded-full bg-upcoming-soft text-sm font-semibold text-upcoming">
                      {initials(p)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{p.first_name} {p.last_name}</span>
                      <span className="block truncate text-sm text-muted">{p.pathway_name} · {p.goal_title}</span>
                    </span>
                    <EnrollmentStatusBadge status={p.status} />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
        <p>Astuce démo : connectez-vous en kiné « Julien Petit » puis ouvrez le dossier de Karim Haddad (suivi par une autre kiné) via son URL.</p>
        <form action={resetDemo}>
          <button type="submit" className="btn btn-secondary text-xs">Réinitialiser les données de démo</button>
        </form>
      </footer>
    </main>
  );
}
