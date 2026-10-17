import Link from "next/link";
import { redirect } from "next/navigation";
import { resetDemo } from "@/app/actions";
import { getSession } from "@/lib/auth";
import { listPersonas } from "@/lib/queries";
import { OFFER_LABEL, PROFESSION_LABEL } from "@/lib/domain";
import { fullName, initials } from "@/lib/format";
import { DEMO_PASSWORD } from "@/lib/passwords";
import { LoginForm, type DemoGroup } from "@/components/login-form";
import { SubmitButton } from "@/components/submit-button";
import { Wordmark } from "@/components/wordmark";

const HOME = { practitioner: "/praticien", patient: "/patient", coordinator: "/coordination" } as const;

export default async function ConnexionPage() {
  const session = await getSession();
  if (session) redirect(HOME[session.type]);

  const { coordinators, practitioners, patients } = await listPersonas();
  const groups: DemoGroup[] = [
    {
      title: "Coordination Via Sana",
      accounts: coordinators.map((c) => ({
        email: c.email, name: `${c.first_name} ${c.last_name}`, detail: "Coordinatrice · logistique du parcours",
        initials: initials(c), tone: "bg-slate-700 text-white",
      })),
    },
    {
      title: "Praticiens partenaires",
      accounts: practitioners.map((p) => ({
        email: p.email, name: fullName(p), detail: `${PROFESSION_LABEL[p.profession]} · ${p.specialty}`,
        initials: initials(p), tone: "bg-brand-soft text-brand",
      })),
    },
    {
      title: "Coureurs (patients)",
      accounts: patients.map((p) => ({
        email: p.email, name: `${p.first_name} ${p.last_name}`, detail: `${OFFER_LABEL[p.offer]} · ${p.goal_title}`,
        initials: initials(p), tone: "bg-upcoming-soft text-upcoming",
      })),
    },
  ];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-muted hover:text-foreground">← Retour à l&apos;accueil</Link>
        <p className="text-sm text-muted">
          Nouveau client ? <Link href="/commencer" className="font-medium text-brand hover:underline">Commencer mon bilan</Link>
        </p>
      </div>
      <div className="mb-8 space-y-3">
        <Wordmark size="lg" />
        <div>
          <h1 className="text-3xl">Bon retour <span className="accent-serif">parmi nous</span></h1>
          <p className="text-sm text-muted">Outil de coordination du parcours — connectez-vous avec votre email et votre mot de passe.</p>
        </div>
      </div>

      <LoginForm groups={groups} demoPassword={DEMO_PASSWORD} />

      <p className="mt-8 text-xs text-muted">
        En production : double facteur pour tous les comptes (recommandation CNIL pour les données de santé) et Pro Santé
        Connect / e-CPS pour les praticiens ; le mot de passe de démonstration commun n&apos;existerait pas.
      </p>
      <footer className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
        <p>Inspiré de l&apos;offre PrépaMarathon (prepamarathon.com). Toutes les personnes et données sont fictives.</p>
        <form action={resetDemo}>
          <SubmitButton variant="secondary" className="text-xs" pendingLabel="Réinitialisation… (environ 30 s)">Réinitialiser les données de démo</SubmitButton>
        </form>
      </footer>
    </main>
  );
}
