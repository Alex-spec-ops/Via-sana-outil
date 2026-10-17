import { addCheckin } from "@/app/actions";
import { SubmitButton } from "./submit-button";

// Colour of each step of a 0–10 scale once picked: green, then amber, then red.
function tone(value: number) {
  if (value >= 7) return "has-checked:border-danger has-checked:bg-danger has-checked:text-white";
  if (value >= 4) return "has-checked:border-ongoing has-checked:bg-ongoing has-checked:text-white";
  return "has-checked:border-done has-checked:bg-done has-checked:text-white";
}

/** A 0–10 scale as a row of radio buttons: one tap on a phone, no typing. */
function Scale({ name, legend, low, high }: { name: string; legend: string; low: string; high: string }) {
  return (
    <fieldset>
      <legend className="label">{legend}</legend>
      <div className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, v) => (
          <label
            key={v}
            className={`flex h-9 cursor-pointer items-center justify-center rounded-md border border-border text-sm tabular-nums transition hover:border-brand has-focus-visible:ring-2 has-focus-visible:ring-brand ${tone(v)}`}
          >
            <input type="radio" name={name} value={v} className="sr-only" />
            {v}
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </fieldset>
  );
}

export function CheckinForm() {
  return (
    <form action={addCheckin} className="space-y-4">
      <div className="max-w-xs">
        <label className="label" htmlFor="weekly_km">Kilomètres courus cette semaine</label>
        <div className="relative">
          <input id="weekly_km" name="weekly_km" type="number" inputMode="decimal" min={0} max={400} step={0.5} className="input pr-12" />
          <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted">km</span>
        </div>
      </div>
      <Scale name="pain" legend="Douleur" low="0 · aucune" high="10 · insupportable" />
      <Scale name="fatigue" legend="Fatigue" low="0 · en forme" high="10 · épuisé·e" />
      <div>
        <label className="label" htmlFor="comment">Un mot pour votre équipe ?</label>
        <input id="comment" name="comment" maxLength={500} className="input" placeholder="Sensations, gêne, imprévu…" />
      </div>
      <div>
        <SubmitButton>Envoyer mon suivi</SubmitButton>
        <p className="mt-2 text-xs text-muted">
          Visible par vos praticiens uniquement. En cas de douleur forte ou de symptôme inquiétant, contactez votre médecin ou le 15.
        </p>
      </div>
    </form>
  );
}
