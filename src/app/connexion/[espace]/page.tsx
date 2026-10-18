import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { listPersonas } from "@/lib/queries";
import { OFFER_LABEL, PROFESSION_LABEL } from "@/lib/domain";
import { fullName, initials } from "@/lib/format";
import { DEMO_PASSWORD } from "@/lib/passwords";
import { HOME, isSpace, type SpaceSlug } from "@/lib/spaces";
import { LoginForm, type DemoAccount } from "@/components/login-form";
import { Wordmark } from "@/components/wordmark";

const COPY: Record<SpaceSlug, { who: string; title: string; accent: string; intro: string; production: string }> = {
  patient: {
    who: "Coureurs",
    title: "Bon retour",
    accent: "parmi nous",
    intro: "Retrouvez votre parcours, votre questionnaire, vos rendez-vous et les conseils de votre équipe.",
    production: "Double authentification (recommandation CNIL pour les données de santé) : après le mot de passe, un code à usage unique est envoyé par email.",
  },
  praticien: {
    who: "Praticiens partenaires et coordination",
    title: "Espace",
    accent: "praticiens partenaires",
    intro: "Praticiens : vous ne voyez que les coureurs qui vous ont accepté dans leur équipe de soins, et seulement les rubriques utiles à votre profession. Coordination Via Sana : l'organisation des parcours, sans le contenu clinique. Chaque compte arrive sur son propre espace.",
    production: "Double authentification par code à usage unique. En production, Pro Santé Connect (carte e-CPS) remplacera mot de passe et code pour les praticiens.",
  },
};

export default async function SpaceLoginPage({ params }: PageProps<"/connexion/[espace]">) {
  const { espace } = await params;
  // The coordination now logs in with the partner practitioners (old links keep working).
  if (espace === "coordination") redirect("/connexion/praticien");
  if (!isSpace(espace)) notFound();
  const session = await getSession();
  if (session) redirect(HOME[session.type]);

  const { coordinators, practitioners, patients } = await listPersonas();
  const accounts: DemoAccount[] =
    espace === "patient"
      ? patients.map((p) => ({
          email: p.email, name: `${p.first_name} ${p.last_name}`, detail: `${OFFER_LABEL[p.offer]} · ${p.goal_title}`,
          initials: initials(p), tone: "bg-accent-soft text-accent-strong",
        }))
      : [
          ...practitioners.map((p) => ({
            email: p.email, name: fullName(p), detail: `${PROFESSION_LABEL[p.profession]} · ${p.specialty}`,
            initials: initials(p), tone: "bg-brand-soft text-brand",
          })),
          ...coordinators.map((c) => ({
            email: c.email, name: `${c.first_name} ${c.last_name}`, detail: "Coordination Via Sana · logistique du parcours",
            initials: initials(c), tone: "bg-brand text-ecru",
          })),
        ];
  const copy = COPY[espace];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/connexion" className="text-sm text-muted hover:text-foreground">← Changer d&apos;espace</Link>
        {espace === "patient" && (
          <p className="text-sm text-muted">
            Nouveau client ? <Link href="/commencer" className="font-medium text-brand hover:underline">Commencer mon bilan</Link>
          </p>
        )}
      </div>
      <div className="mb-8 space-y-3">
        <div><Wordmark size="lg" /></div>
        <p>
          <span className={`eyebrow ${espace === "patient" ? "bg-accent text-ecru" : "bg-brand text-ecru"}`}>{copy.who}</span>
        </p>
        <h1 className="text-3xl md:text-4xl">{copy.title} <span className="accent-serif">{copy.accent}</span></h1>
        <p className="max-w-2xl text-sm text-muted">{copy.intro}</p>
      </div>

      <LoginForm space={espace} accounts={accounts} demoPassword={DEMO_PASSWORD} />

      <p className="mt-8 text-xs text-muted">
        {copy.production} Le mot de passe de démonstration commun n&apos;existerait pas.
      </p>
    </main>
  );
}
