import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CODE_TTL_MINUTES, currentChallenge, latestMessage, maskEmail } from "@/lib/mfa";
import { HOME } from "@/lib/spaces";
import { formatTime } from "@/lib/format";
import { VerifyForm } from "@/components/verify-form";
import { Wordmark } from "@/components/wordmark";

export default async function VerificationPage() {
  const session = await getSession();
  if (session) redirect(HOME[session.type]);
  const challenge = await currentChallenge();

  if (!challenge) {
    return (
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-16">
        <div className="mb-6"><Wordmark size="lg" /></div>
        <h1 className="text-3xl">Code <span className="accent-serif">expiré</span></h1>
        <p className="mt-2 text-sm text-muted">Cette étape de vérification n&apos;est plus valable. Reconnectez-vous pour recevoir un nouveau code.</p>
        <Link href="/connexion" className="btn btn-primary mt-6">Se reconnecter</Link>
      </main>
    );
  }

  const message = await latestMessage(challenge.id);
  const demoCode = message?.body.match(/\d{6}/)?.[0] ?? null;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
      <div className="mb-8 space-y-3">
        <div><Wordmark size="lg" /></div>
        <p><span className="eyebrow">Double authentification</span></p>
        <h1 className="text-3xl md:text-4xl">Vérifiez <span className="accent-serif">votre identité</span></h1>
        <p className="max-w-2xl text-sm text-muted">
          Mot de passe correct. Nous venons d&apos;envoyer un code à 6 chiffres à <strong className="text-foreground">{maskEmail(challenge.email)}</strong>.
          Il est valable {CODE_TTL_MINUTES} minutes et ne sert qu&apos;une fois.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <VerifyForm demoCode={demoCode} />

        <section aria-label="Boîte mail de démonstration">
          <div className="mb-3 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand">
            <strong>Boîte mail de démonstration.</strong> Les adresses du prototype sont fictives : le message qui serait envoyé
            s&apos;affiche ici. En production, il arrive dans la vraie boîte du coureur, par email ou SMS.
          </div>
          {message && (
            <article className="card overflow-hidden">
              <div className="space-y-1 border-b border-border bg-surface-alt px-5 py-3 text-xs text-muted">
                <p><span className="font-semibold text-foreground">De :</span> PrépaMarathon · Via Sana &lt;no-reply@viasana.example&gt;</p>
                <p><span className="font-semibold text-foreground">À :</span> {message.recipient}</p>
                <p><span className="font-semibold text-foreground">Objet :</span> {message.subject} · {formatTime(message.created_at)}</p>
              </div>
              <div className="space-y-3 px-5 py-5 text-sm">
                <p>Bonjour,</p>
                <p>Votre code de connexion :</p>
                <p className="font-display text-4xl font-bold tracking-[0.3em] text-brand">{demoCode}</p>
                {message.body.split("\n").slice(1).map((line) => <p key={line} className="text-muted">{line}</p>)}
              </div>
            </article>
          )}
        </section>
      </div>
    </main>
  );
}
