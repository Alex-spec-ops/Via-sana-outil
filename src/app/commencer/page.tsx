import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { SignupForm } from "@/components/signup-form";
import { Wordmark } from "@/components/wordmark";

export default async function StartPage() {
  const session = await getSession();
  if (session?.type === "patient") redirect("/patient");

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">← Retour</Link>
      <div className="mt-6 mb-6 space-y-3">
        <Wordmark />
        <div>
          <h1 className="text-3xl">Commencer mon <span className="accent-serif">bilan de course</span></h1>
          <p className="text-sm text-muted">Étape 1 sur 2 : vos coordonnées et votre mot de passe. Ensuite, le questionnaire (5 minutes).</p>
        </div>
      </div>

      <div className="mb-4">
        <Notice tone="current">
          <strong>Prototype de démonstration.</strong> Utilisez des informations fictives : rien n&apos;est envoyé à un praticien réel.
        </Notice>
      </div>
      <SignupForm />

      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit·e ? <Link href="/connexion/patient" className="text-brand hover:underline">Se connecter</Link>
      </p>
    </main>
  );
}
