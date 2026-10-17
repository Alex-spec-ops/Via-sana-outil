import Link from "next/link";
import { getSession } from "@/lib/auth";
import { COORDINATION_OFFER } from "@/lib/domain";
import { Wordmark } from "@/components/wordmark";

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

  const start = space === "/patient" ? "/patient" : "/commencer";

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
          <Link href="/" className="flex items-center">
            <Wordmark />
          </Link>
          <nav className="ml-auto flex items-center gap-2">
            <a href="#comment" className="hidden px-3 py-1.5 font-display text-sm tracking-[0.08em] text-muted uppercase hover:text-foreground sm:block">
              Comment ça marche
            </a>
            {space ? (
              <Link href={space} className="btn bg-foreground text-ecru hover:bg-brand">Mon espace</Link>
            ) : (
              <Link href="/connexion" className="btn bg-foreground text-ecru hover:bg-brand">Se connecter</Link>
            )}
          </nav>
        </div>
        <p className="bg-brand-soft px-4 py-1 text-center text-xs text-brand">
          Prototype de démonstration — n&apos;entrez pas de vraies données de santé.
        </p>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-16 pb-20 text-center md:pt-24">
          <span className="eyebrow">Le bilan de course · Paris</span>
          <h1 className="mt-6 text-5xl md:text-7xl">
            Préparez votre course.
            <span className="accent-serif mt-2 block text-3xl md:text-4xl">Entouré·e des bons praticiens.</span>
          </h1>
          <p className="mx-auto mt-8 max-w-xl text-base">
            <strong>30 minutes avec un kinésithérapeute du sport.</strong>
            <br />
            Un plan d&apos;action écrit pour vous, puis, si vous le souhaitez, une équipe coordonnée jusqu&apos;à la ligne d&apos;arrivée.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href={start} className="btn btn-primary px-8 py-4 text-base">Commencer mon bilan</Link>
            <Link href="/connexion" className="btn btn-secondary px-8 py-4 text-base">J&apos;ai déjà un compte</Link>
          </div>
          <p className="mt-4 text-sm text-muted">5 minutes de questions · sans engagement</p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-20 sm:grid-cols-3">
          <div className="rounded-[20px] bg-accent px-7 py-6 text-ecru">
            <p className="font-display text-5xl font-bold">30 <span className="text-xl">min</span></p>
            <p className="mt-1 text-sm">en face à face avec le kiné</p>
          </div>
          <div className="rounded-[20px] bg-brand px-7 py-6 text-ecru">
            <p className="font-display text-5xl font-bold text-azurin">6</p>
            <p className="mt-1 text-sm">dimensions examinées : antécédents, volume, objectif, douleurs, appuis, déséquilibres</p>
          </div>
          <div className="rounded-[20px] bg-azurin px-7 py-6 text-brand">
            <p className="font-display text-5xl font-bold">1 <span className="text-xl">PDF</span></p>
            <p className="mt-1 text-sm">votre plan d&apos;action, qui vous appartient</p>
          </div>
        </section>

        <section id="comment" className="scroll-mt-20 bg-brand text-ecru">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <div className="text-center">
              <span className="eyebrow">Comment ça se passe</span>
              <h2 className="mt-5 text-4xl md:text-5xl">
                Des étapes claires, <span className="accent-serif">zéro paperasse</span> pour vous
              </h2>
            </div>
            <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex flex-col gap-3 rounded-3xl border border-azurin/25 bg-brand-strong p-7">
                  <span className="font-display text-6xl font-bold text-transparent [-webkit-text-stroke:1.5px_var(--azurin)]">{s.n}</span>
                  <h3 className="text-lg font-bold uppercase">{s.title}</h3>
                  <p className="flex-1 text-sm text-ecru/85">{s.text}</p>
                  <p className="font-display text-xs tracking-[0.12em] text-azurin uppercase">{s.meta}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 text-center text-sm text-ecru/75">
              Le bilan est une consultation de kinésithérapie réglée au praticien, remboursable selon votre situation. Vous pouvez vous
              arrêter après le bilan : votre plan d&apos;action vous appartient.
            </p>
          </div>
        </section>

        <section className="bg-surface-alt">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <span className="eyebrow bg-accent text-ecru">Vos données</span>
            <h2 className="mt-5 text-4xl">
              Votre dossier <span className="accent-serif">reste le vôtre</span>
            </h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PRIVACY.map((p) => (
                <div key={p.title} className="card p-6">
                  <h3 className="text-base font-bold uppercase">{p.title}</h3>
                  <p className="mt-2 text-sm text-muted">{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-foreground p-10 text-ecru">
            <div>
              <span className="eyebrow">Tous niveaux</span>
              <h2 className="mt-4 text-3xl md:text-4xl">
                Votre course a une date. <span className="accent-serif">Votre préparation commence ici.</span>
              </h2>
              <p className="mt-2 text-ecru/75">Cinq minutes de questions sur votre course, votre objectif et votre historique.</p>
            </div>
            <Link href={start} className="btn btn-primary px-8 py-4 text-base">Commencer mon bilan</Link>
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
