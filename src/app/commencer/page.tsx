import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Notice } from "@/components/ui";
import { SignupForm } from "@/components/signup-form";

export default async function StartPage() {
  const session = await getSession();
  if (session?.type === "patient") redirect("/patient");

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10">
      <Link href="/" className="text-sm text-muted hover:text-foreground">← Retour</Link>
      <div className="mt-4 mb-6 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-brand font-bold text-white">VS</span>
        <div>
          <h1 className="text-2xl font-semibold">Commencer mon bilan de course</h1>
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
        Déjà inscrit·e ? <Link href="/connexion" className="text-brand hover:underline">Se connecter</Link>
      </p>
    </main>
  );
}
