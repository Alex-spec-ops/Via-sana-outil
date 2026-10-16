import Link from "next/link";
import { getSession } from "@/lib/auth";
import { COORDINATION_OFFER } from "@/lib/domain";

const HOME = { practitioner: "/praticien", patient: "/patient", coordinator: "/coordination" } as const;

const STEPS = [
  {
    n: "01",
    title: "Vous répondez au questionnaire",
    text: "Votre historique de course, votre objectif, vos éventuelles gênes. Le kinésithérapeute le lit avant de vous voir.",
    meta: "5 minutes · en ligne",
  },
  {
    n: "02",
    title: "Le bilan de course",
    text: "30 minutes avec un kinésithérapeute du sport : antécédents, volume, douleurs, appuis, bilan fonctionnel.",
    meta: "30 minutes · au cabinet",
  },
  {
    n: "03",
    title: "Votre plan d'action",
    text: "Les observations du kiné et des recommandations concrètes, dans un compte rendu PDF qui vous appartient.",
    meta: "PDF · à garder",
  },
  {
    n: "04",
    title: "Un suivi coordonné, si vous le souhaitez",
    text: "Une équipe composée selon les besoins de votre bilan, des rendez-vous organisés pour vous, un dossier unique.",
    meta: `Optionnel · ${COORDINATION_OFFER.price} pour ${COORDINATION_OFFER.months} mois`,
  },
];

const PRIVACY = [
  { title: "Secret médical", text: "Chaque praticien ne voit que ce dont il a besoin pour vous soigner." },
  { title: "Vous choisissez votre équipe", text: "Aucun praticien n'accède à votre dossier sans votre accord." },
  { title: "Une coordination sans données de santé", text: "Votre coordinatrice organise, mais ne lit pas votre dossier médical." },
  { title: "Tout est tracé", text: "Vous voyez qui a consulté votre dossier, et quand." },
];

export default async function Landing() {
  const session = await getSession();
  const space = session ? HOME[session.type] : null;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">VS</span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold">PrépaMarathon</span>
              <span className="block text-xs text-muted">par Via Sana</span>
            </span>
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <a href="#comment" className="hidden rounded-md px-3 py-1.5 text-sm text-muted hover:text-foreground sm:block">Comment ça marche</a>
            {space ? (
              <Link href={space} className="btn btn-primary">Mon espace</Link>
            ) : (
              <Link href="/connexion" className="btn btn-secondary">Se connecter</Link>
            )}
          </nav>
        </div>
        <p className="bg-brand-soft px-4 py-1 text-center text-xs text-brand">
          Prototype de démonstration — n&apos;entrez pas de vraies données de santé.
        </p>
      </header>

      <main className="flex-1">
        <section className="bg-brand text-white">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-[1.3fr_1fr] md:py-24">
            <div>
              <p className="text-sm font-semibold tracking-widest text-white/70 uppercase">Le bilan de course · Paris</p>
              <h1 className="mt-3 text-4xl leading-tight font-semibold md:text-5xl">
                Préparez votre course,<br />entouré·e des bons praticiens.
              </h1>
              <p className="mt-5 max-w-xl text-lg text-white/85">
                Un bilan de 30 minutes avec un kinésithérapeute du sport, un plan d&apos;action écrit pour vous, puis, si vous le
                souhaitez, une équipe coordonnée jusqu&apos;à la ligne d&apos;arrivée.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href={space === "/patient" ? "/patient" : "/commencer"} className="btn bg-white px-6 py-3 text-base text-brand hover:bg-brand-soft">
                  Commencer mon bilan
                </Link>
                <Link href="/connexion" className="btn border border-white/40 px-6 py-3 text-base text-white hover:bg-white/10">
                  J&apos;ai déjà un compte
                </Link>
              </div>
              <p className="mt-3 text-sm text-white/70">5 minutes de questions · sans engagement</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-6 ring-1 ring-white/20">
              <p className="text-sm font-semibold tracking-wide text-white/70 uppercase">Le bilan examine</p>
              <ul className="mt-3 space-y-2.5 text-white/90">
                {["Vos antécédents de coureur", "Votre volume et votre programme", "Votre objectif et sa planification", "Vos douleurs et gênes", "Vos appuis et votre foulée", "Les déséquilibres à surveiller"].map((d) => (
                  <li key={d} className="flex items-center gap-2.5">
                    <span className="flex size-5 items-center justify-center rounded-full bg-white text-xs font-bold text-brand" aria-hidden>✓</span>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id="comment" className="mx-auto max-w-6xl scroll-mt-8 px-4 py-16">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">Comment ça se passe</p>
          <h2 className="mt-2 text-3xl font-semibold">Des étapes claires, zéro paperasse pour vous</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n} className="card flex flex-col gap-3 p-5">
                <span className="text-3xl font-semibold text-brand">{s.n}</span>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="flex-1 text-sm text-muted">{s.text}</p>
                <p className="text-xs font-semibold tracking-wide text-brand uppercase">{s.meta}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 text-sm text-muted">
            Le bilan est une consultation de kinésithérapie réglée au praticien, remboursable selon votre situation. Vous pouvez vous
            arrêter après le bilan : votre plan d&apos;action vous appartient.
          </p>
        </section>

        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <p className="text-sm font-semibold tracking-widest text-brand uppercase">Vos données</p>
            <h2 className="mt-2 text-3xl font-semibold">Votre dossier reste le vôtre</h2>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRIVACY.map((p) => (
                <div key={p.title} className="rounded-xl bg-background p-5">
                  <h3 className="font-semibold">{p.title}</h3>
                  <p className="mt-1.5 text-sm text-muted">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <div className="card flex flex-wrap items-center justify-between gap-6 p-8">
            <div>
              <h2 className="text-2xl font-semibold">Votre course a une date. Votre préparation commence ici.</h2>
              <p className="mt-1 text-muted">Cinq minutes de questions sur votre course, votre objectif et votre historique.</p>
            </div>
            <Link href={space === "/patient" ? "/patient" : "/commencer"} className="btn btn-primary px-6 py-3 text-base">Commencer mon bilan</Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted">
          <p>Via Sana · prototype de l&apos;outil de coordination PrépaMarathon. Toutes les données sont fictives.</p>
          <Link href="/connexion" className="hover:text-foreground">Espace praticiens et coordination →</Link>
        </div>
      </footer>
    </div>
  );
}
