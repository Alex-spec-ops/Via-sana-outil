"use client";

import { useActionState, useState } from "react";
import { startBilan, type SignupState } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { Notice } from "@/components/ui";

const PASSWORD_MAX_LENGTH = 128;

// Mirrors passwordProblem() on the server (CNIL 2022-100, "case n° 1"), for live feedback only.
function rules(password: string) {
  const mix = /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
  const special = /[^A-Za-z0-9]/.test(password);
  return [
    { ok: password.length >= 14 || (password.length >= 12 && special), label: "14 caractères, ou 12 avec un caractère spécial" },
    { ok: mix, label: "majuscules, minuscules et chiffres" },
  ];
}

export function SignupForm() {
  const [state, action] = useActionState<SignupState, FormData>(startBilan, { error: null, values: {} });
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const v = state.values;
  const checks = rules(password);

  return (
    <form action={action} className="card space-y-4 p-6">
      {state.error && <Notice tone="danger">{state.error}</Notice>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="first_name">Prénom *</label>
          <input id="first_name" name="first_name" required maxLength={60} autoComplete="off" defaultValue={v.first_name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="last_name">Nom *</label>
          <input id="last_name" name="last_name" required maxLength={60} autoComplete="off" defaultValue={v.last_name} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="birth_date">Date de naissance *</label>
          <input id="birth_date" name="birth_date" type="date" required defaultValue={v.birth_date} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="sex">Sexe</label>
          <select id="sex" name="sex" className="input" defaultValue={v.sex ?? "X"} key={v.sex}>
            <option value="F">Femme</option>
            <option value="M">Homme</option>
            <option value="X">Autre / ne pas préciser</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="email">Email *</label>
          <input id="email" name="email" type="email" required maxLength={120} autoComplete="username" defaultValue={v.email} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Téléphone</label>
          <input id="phone" name="phone" type="tel" maxLength={30} autoComplete="off" defaultValue={v.phone} className="input" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="goal">Votre objectif</label>
        <input id="goal" name="goal" maxLength={120} defaultValue={v.goal} className="input" placeholder="Ex. : finir le Marathon de Paris en 4h" />
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-semibold">Votre mot de passe</legend>
        <div>
          <div className="flex items-center justify-between">
            <label className="label" htmlFor="password">Mot de passe *</label>
            <button type="button" onClick={() => setVisible((x) => !x)} className="text-xs text-brand hover:underline">
              {visible ? "Masquer" : "Afficher"}
            </button>
          </div>
          <input
            id="password" name="password" type={visible ? "text" : "password"} required minLength={12} maxLength={PASSWORD_MAX_LENGTH}
            autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input"
          />
          <ul className="mt-2 space-y-0.5 text-xs">
            {checks.map((c) => (
              <li key={c.label} className={c.ok ? "text-done" : "text-muted"}>{c.ok ? "✓" : "○"} {c.label}</li>
            ))}
          </ul>
        </div>
        <div>
          <label className="label" htmlFor="password_confirmation">Confirmation *</label>
          <input
            id="password_confirmation" name="password_confirmation" type={visible ? "text" : "password"} required
            maxLength={PASSWORD_MAX_LENGTH} autoComplete="new-password" value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)} className="input"
          />
          {confirmation && confirmation !== password && <p className="mt-1 text-xs text-danger">Les deux mots de passe diffèrent.</p>}
        </div>
        <p className="text-xs text-muted">
          Astuce : une phrase de passe (« Mon-marathon-de-Paris-2027 ») est plus facile à retenir et plus solide. Évitez votre nom ou votre email.
        </p>
      </fieldset>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" value="1" required className="mt-1" />
        <span>
          J&apos;accepte que mes informations soient utilisées pour organiser mon bilan et transmises uniquement aux praticiens que
          je consulte dans le cadre du parcours.
        </span>
      </label>
      <SubmitButton className="w-full py-3 text-base" pendingLabel="Création du compte…">Créer mon compte et continuer</SubmitButton>
      <p className="text-center text-xs text-muted">Sans engagement. Vous pourrez vous arrêter après le bilan.</p>
    </form>
  );
}
