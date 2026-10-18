"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { cancelLoginCode, verifyLoginCode, type VerifyState } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Notice } from "@/components/ui";

/** Second step of the login: the 6-digit code. `demoCode` fills it in (demo mailbox only). */
export function VerifyForm({ demoCode }: { demoCode: string | null }) {
  const [state, action] = useActionState<VerifyState, FormData>(verifyLoginCode, { error: null, info: null });
  const [code, setCode] = useState("");
  const input = useRef<HTMLInputElement>(null);

  if (state.expired) {
    return (
      <div className="card space-y-4 p-6">
        <Notice tone="danger">{state.error}</Notice>
        <Link href="/connexion" className="btn btn-primary w-full py-3">Se reconnecter</Link>
      </div>
    );
  }

  return (
    <div className="card space-y-4 p-6">
      <form action={action} className="space-y-4">
        {state.error && <Notice tone="danger">{state.error}</Notice>}
        {state.info && <Notice tone="done">{state.info}</Notice>}
        <div>
          <label className="label" htmlFor="code">Code reçu par email</label>
          <input
            id="code" name="code" ref={input} required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,12}" maxLength={12}
            value={code} onChange={(e) => setCode(e.target.value)} autoFocus
            className="input text-center font-display text-3xl tracking-[0.3em]" placeholder="••••••••"
          />
        </div>
        <SubmitButton name="intent" value="verify" className="w-full py-3 text-base" pendingLabel="Vérification…">Valider le code</SubmitButton>
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <button type="submit" name="intent" value="resend" formNoValidate className="text-brand hover:underline">Renvoyer un code</button>
          {demoCode && (
            <button type="button" onClick={() => { setCode(demoCode); input.current?.focus(); }} className="text-muted hover:text-foreground">
              Démo : remplir le code reçu
            </button>
          )}
        </div>
      </form>
      <form action={cancelLoginCode}>
        <button type="submit" className="text-xs text-muted hover:text-foreground">← Annuler et revenir à la connexion</button>
      </form>
    </div>
  );
}
