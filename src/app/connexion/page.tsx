import Link from "next/link";
import { redirect } from "next/navigation";
import { resetDemo } from "@/app/actions";
import { getSession } from "@/lib/auth";
import { HOME, SPACES } from "@/lib/spaces";
import { SubmitButton } from "@/components/submit-button";
import { Wordmark } from "@/components/wordmark";

const DOORS = [
  {
    href: SPACES.patient.login,
    who: "Je suis coureur",
    text: "Mon parcours, mon questionnaire, les conseils de mon équipe et mes données.",
    tone: "bg-accent text-ecru",
    cta: "bg-ecru text-accent",
  },
  {
    href: SPACES.praticien.login,
    who: "Je suis praticien partenaire",
    text: "Les coureurs qui m'ont accepté dans leur équipe de soins, leurs bilans et leur suivi.",
    tone: "bg-brand text-ecru",
    cta: "bg-azurin text-brand",
  },
  {
    href: SPACES.coordination.login,
    who: "Coordination Via Sana",
    text: "L'organisation des parcours : questionnaires, rendez-vous, équipes, relances. Sans données de santé.",
    tone: "bg-azurin text-brand",
    cta: "bg-brand text-ecru",
  },
];

export default async function ConnexionPage() {
  const session = await getSession();
  if (session) redirect(HOME[session.type]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
      <div className="mb-10 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="text-sm text-muted hover:text-foreground">← Retour à l&apos;accueil</Link>
        <p className="text-sm text-muted">
          Nouveau client ? <Link href="/commencer" className="font-medium text-brand hover:underline">Commencer mon bilan</Link>
        </p>
      </div>
      <div className="mb-10 space-y-3 text-center">
        <Wordmark size="lg" sub={null} />
        <h1 className="text-4xl md:text-5xl">Se connecter à <span className="accent-serif">votre espace</span></h1>
        <p className="text-muted">Chaque profil a sa propre page de connexion et ne voit que ce qui le concerne.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {DOORS.map((d) => (
          <Link key={d.href} href={d.href} className={`group flex flex-col gap-4 rounded-3xl p-7 transition hover:-translate-y-1 ${d.tone}`}>
            <h2 className="text-2xl">{d.who}</h2>
            <p className="flex-1 text-sm opacity-90">{d.text}</p>
            <span className={`btn w-fit ${d.cta}`}>Se connecter →</span>
          </Link>
        ))}
      </div>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-muted">
        <p>Inspiré de l&apos;offre PrépaMarathon (prepamarathon.com). Toutes les personnes et données sont fictives.</p>
        <form action={resetDemo}>
          <SubmitButton variant="secondary" className="text-xs" pendingLabel="Réinitialisation… (environ 30 s)">Réinitialiser les données de démo</SubmitButton>
        </form>
      </footer>
    </main>
  );
}
