import Link from "next/link";
import { redirect } from "next/navigation";
import { startBilan } from "@/app/actions";
import { getSession } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export default async function StartPage({ searchParams }: PageProps<"/commencer">) {
  const session = await getSession();
  if (session?.type === "patient") redirect("/patient");
  const { erreur } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">← Retour</Link>
      <div className="mt-4 mb-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand font-bold text-white">VS</span>
        <div>
          <h1 className="text-2xl font-semibold">Commencer mon bilan de course</h1>
          <p className="text-sm text-muted">Étape 1 sur 2 : vos coordonnées. Ensuite, le questionnaire (5 minutes).</p>
        </div>
      </div>

      <div className="mb-4">
        <Notice tone="current">
          <strong>Prototype de démonstration.</strong> Utilisez des informations fictives : rien n&apos;est envoyé à un praticien réel.
        </Notice>
      </div>
      {erreur === "1" && (
        <div className="mb-4">
          <Notice tone="danger">Merci de vérifier les champs obligatoires et d&apos;accepter les conditions.</Notice>
        </div>
      )}

      <form action={startBilan} className="card space-y-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="first_name">Prénom *</label>
            <input id="first_name" name="first_name" required maxLength={60} autoComplete="off" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="last_name">Nom *</label>
            <input id="last_name" name="last_name" required maxLength={60} autoComplete="off" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="birth_date">Date de naissance *</label>
            <input id="birth_date" name="birth_date" type="date" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="sex">Sexe</label>
            <select id="sex" name="sex" className="input" defaultValue="X">
              <option value="F">Femme</option>
              <option value="M">Homme</option>
              <option value="X">Autre / ne pas préciser</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="email">Email *</label>
            <input id="email" name="email" type="email" required maxLength={120} autoComplete="off" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Téléphone</label>
            <input id="phone" name="phone" type="tel" maxLength={30} autoComplete="off" className="input" />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="goal">Votre objectif</label>
          <input id="goal" name="goal" maxLength={120} className="input" placeholder="Ex. : finir le Marathon de Paris en 4h" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consent" value="1" required className="mt-1" />
          <span>
            J&apos;accepte que mes informations soient utilisées pour organiser mon bilan et transmises uniquement aux praticiens que
            je consulte dans le cadre du parcours.
          </span>
        </label>
        <SubmitButton className="w-full py-3 text-base">Continuer vers le questionnaire</SubmitButton>
        <p className="text-center text-xs text-muted">Sans engagement. Vous pourrez vous arrêter après le bilan.</p>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit·e ? <Link href="/connexion" className="text-brand hover:underline">Se connecter</Link>
      </p>
    </main>
  );
}
