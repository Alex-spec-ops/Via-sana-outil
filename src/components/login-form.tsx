"use client";

import { useActionState, useRef, useState } from "react";
import { loginWithPassword, type LoginState } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Notice } from "@/components/ui";
import type { SpaceSlug } from "@/lib/spaces";

export type DemoAccount = { email: string; name: string; detail: string; initials: string; tone: string };

const PASSWORD_MAX_LENGTH = 128;

/** Email + password login of one space; the demo accounts listed are that space's only. */
export function LoginForm({ space, accounts, demoPassword }: { space: SpaceSlug; accounts: DemoAccount[]; demoPassword: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginWithPassword, { error: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  function fill(account: DemoAccount) {
    setEmail(account.email);
    setPassword(demoPassword);
    passwordRef.current?.focus();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
      <form action={action} className="card h-fit space-y-4 p-6">
        <h2 className="text-lg font-semibold">Se connecter</h2>
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        <input type="hidden" name="space" value={space} />
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input
            id="email" name="email" type="email" required maxLength={120} autoComplete="username"
            value={email} onChange={(e) => setEmail(e.target.value)} className="input"
          />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Mot de passe</label>
            <button type="button" onClick={() => setVisible((v) => !v)} className="text-xs text-brand hover:underline">
              {visible ? "Masquer" : "Afficher"}
            </button>
          </div>
          <input
            id="password" name="password" ref={passwordRef} type={visible ? "text" : "password"} required
            maxLength={PASSWORD_MAX_LENGTH} autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} className="input"
          />
        </div>
        <SubmitButton className="w-full py-3 text-base" pendingLabel="Connexion…">Se connecter</SubmitButton>
        <p className="text-xs text-muted">
          Double authentification : un code à 6 chiffres vous est ensuite envoyé. Après 5 essais infructueux, le compte est suspendu 15 minutes.
        </p>
      </form>

      <section>
        <div className="mb-4 rounded-xl border border-brand/20 bg-brand-soft px-4 py-3 text-sm text-brand">
          <strong>Comptes de démonstration.</strong> Cliquez sur un profil fictif pour remplir le formulaire, puis
          « Se connecter ». Mot de passe commun : <code className="rounded bg-white/70 px-1 font-semibold">{demoPassword}</code>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {accounts.map((a) => (
            <li key={a.email}>
              <button
                type="button" onClick={() => fill(a)}
                className={`card flex w-full items-center gap-3 p-2.5 text-left transition hover:border-brand ${email === a.email ? "border-brand" : ""}`}
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${a.tone}`}>{a.initials}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="block truncate text-xs text-muted">{a.detail}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
