"use client";

import { useRef, useState, type FormEvent } from "react";
import { saveIntake } from "@/app/actions";
import type { IntakeAnswers, IntakeField, IntakeSection } from "@/lib/domain";
import { SubmitButton } from "./submit-button";

// Step-by-step questionnaire, modelled on PrépaMarathon's Eval&GO form: one
// section per page, "Précédent" / "Suivant", required questions marked with *.
// Every section stays in the same <form> (hidden when not current), so a draft
// or the final submission sends all answers at once.

type Props = {
  sections: IntakeSection[];
  answers: IntakeAnswers;
  firstName: string;
  startAtIntro: boolean;
  submitted: boolean;
};

function Stepper({ field, value }: { field: Extract<IntakeField, { type: "number" }>; value: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const step = (delta: number) => {
    const input = ref.current;
    if (!input) return;
    const current = input.value === "" ? (field.min ?? 0) + (delta > 0 ? -1 : 1) : Number(input.value);
    const next = Math.min(field.max ?? 999, Math.max(field.min ?? 0, current + delta));
    input.value = String(next);
  };
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => step(-1)} className="btn btn-secondary size-11 !p-0 text-lg" aria-label="Diminuer">−</button>
      <input
        ref={ref}
        id={`f-${field.id}`}
        name={field.id}
        type="number"
        inputMode="decimal"
        defaultValue={value}
        min={field.min}
        max={field.max}
        step="any"
        className="input w-32 text-center text-base"
      />
      <button type="button" onClick={() => step(1)} className="btn btn-secondary size-11 !p-0 text-lg" aria-label="Augmenter">+</button>
      {field.unit && <span className="text-sm text-muted">{field.unit}</span>}
    </div>
  );
}

function Slider({ field, value }: { field: Extract<IntakeField, { type: "range" }>; value: string }) {
  const [current, setCurrent] = useState(value === "" ? String(Math.round((field.min + field.max) / 2)) : value);
  return (
    <div>
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">{field.min}</span>
        <input
          id={`f-${field.id}`}
          name={field.id}
          type="range"
          min={field.min}
          max={field.max}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="w-full accent-[var(--brand)]"
        />
        <span className="text-sm text-muted">{field.max}</span>
      </div>
      <p className="mt-2 text-center">
        <span className="rounded-md bg-brand px-2.5 py-1 text-sm font-semibold text-white">{current} {field.unit}</span>
      </p>
    </div>
  );
}

function Choice({ field, value }: { field: Extract<IntakeField, { type: "choice" }>; value: IntakeAnswers[string] | undefined }) {
  const selected = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  // "Aucun / Aucune" is exclusive with the other ticks.
  const onToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!field.multiple || !e.target.checked) return;
    const boxes = e.target.form?.querySelectorAll<HTMLInputElement>(`input[name="${field.id}"]`) ?? [];
    const noneTicked = e.target.value.startsWith("Aucun");
    boxes.forEach((box) => {
      if (box !== e.target && (noneTicked || box.value.startsWith("Aucun"))) box.checked = false;
    });
  };
  return (
    <div className={`grid gap-2.5 ${field.columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {field.options.map((option) => (
        <label
          key={option}
          className="flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-sm transition hover:border-brand/50 has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand"
        >
          <input
            type={field.multiple ? "checkbox" : "radio"}
            name={field.id}
            value={option}
            defaultChecked={selected.includes(option)}
            onChange={onToggle}
            className="size-4 accent-[var(--brand)]"
          />
          <span className="text-sm">{option}</span>
        </label>
      ))}
    </div>
  );
}

function Field({ field, value, error }: { field: IntakeField; value: IntakeAnswers[string] | undefined; error: boolean }) {
  const str = value === null || value === undefined || Array.isArray(value) ? "" : String(value);
  const isGroup = field.type === "choice";
  const Label = isGroup ? "legend" : "label";
  const content = (
    <>
      <Label {...(!isGroup ? { htmlFor: `f-${field.id}` } : {})} className="text-base font-semibold leading-snug">
        {field.label}
        {field.required && <span className="ml-1 text-danger" aria-hidden>*</span>}
      </Label>
      {field.hint && <p className="mt-1 text-sm text-muted">{field.hint}</p>}
      <div className="mt-3">
        {field.type === "choice" ? (
          <Choice field={field} value={value} />
        ) : field.type === "number" ? (
          <Stepper field={field} value={str} />
        ) : field.type === "range" ? (
          <Slider field={field} value={str} />
        ) : field.type === "textarea" ? (
          <textarea id={`f-${field.id}`} name={field.id} defaultValue={str} rows={3} className="input" placeholder="Saisissez votre réponse" />
        ) : (
          <input
            id={`f-${field.id}`}
            name={field.id}
            type={field.type}
            defaultValue={str}
            placeholder={"placeholder" in field ? field.placeholder : undefined}
            className="input max-w-md"
          />
        )}
      </div>
      {error && <p className="mt-2 text-sm font-medium text-danger" role="alert">Merci de répondre à cette question.</p>}
    </>
  );
  return isGroup ? <fieldset>{content}</fieldset> : <div>{content}</div>;
}

export function IntakeWizard({ sections, answers, firstName, startAtIntro, submitted }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [step, setStep] = useState(startAtIntro ? 0 : 1); // 0 = introduction, 1..n = sections
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const total = sections.length;

  /** Required questions of a section left unanswered, read from the form itself. */
  const missing = (index: number) => {
    const form = formRef.current;
    if (!form) return [];
    const data = new FormData(form);
    return sections[index].fields
      .filter((f) => f.required)
      .filter((f) => {
        const values = data.getAll(f.id).filter((v) => typeof v === "string" && v.trim() !== "");
        return values.length === 0;
      })
      .map((f) => f.id);
  };

  const goTo = (next: number) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const next = () => {
    const gaps = missing(step - 1);
    setErrors(new Set(gaps));
    if (gaps.length === 0) goTo(step + 1);
    else formRef.current?.querySelector(`[name="${gaps[0]}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value !== "submit") return; // drafts are saved as they are
    for (let i = 0; i < total; i++) {
      const gaps = missing(i);
      if (gaps.length) {
        e.preventDefault();
        setErrors(new Set(gaps));
        goTo(i + 1);
        return;
      }
    }
  };

  const section = step > 0 ? sections[step - 1] : null;
  const progress = Math.round((Math.max(0, step - 1) / total) * 100);

  return (
    <form ref={formRef} action={saveIntake} onSubmit={onSubmit} noValidate className="space-y-6">
      {step === 0 && (
        <section className="card space-y-4 p-6 sm:p-8">
          <p className="text-sm font-semibold tracking-widest text-brand uppercase">Bilan de course</p>
          <h2 className="text-2xl font-semibold">Bienvenue {firstName} !</h2>
          <div className="space-y-2 text-muted">
            <p>Ce questionnaire vous prendra 5 minutes.</p>
            <p>
              Vos réponses permettront au kinésithérapeute de passer directement aux examens le jour du bilan, sans avoir à tout vous
              redemander à l&apos;oral.
            </p>
            <p>
              Elles sont couvertes par le secret médical : chaque praticien ne voit que les rubriques utiles à sa spécialité, et votre
              coordinatrice ne voit que l&apos;organisation.
            </p>
          </div>
          <button type="button" onClick={() => goTo(1)} className="btn btn-primary px-6 py-3 text-base">Commencer</button>
        </section>
      )}

      {step > 0 && (
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{section?.group}</span>
            <span className="text-muted">Étape {step} sur {total}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-upcoming-soft" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {sections.map((s, i) => (
        <section key={s.id} hidden={step !== i + 1} className="card space-y-8 p-6 sm:p-8">
          <header>
            <p className="text-lg font-semibold text-brand">{s.group}</p>
            <h2 className="text-xl text-muted italic">{s.title}</h2>
            <p className="mt-3 text-sm text-muted italic">Les questions marquées d&apos;un astérisque (<span className="text-danger">*</span>) doivent obligatoirement être remplies.</p>
          </header>
          {s.fields.map((f) => (
            <Field key={f.id} field={f} value={answers[f.id]} error={errors.has(f.id)} />
          ))}
        </section>
      ))}

      {step > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => goTo(step - 1)} className="btn btn-secondary" disabled={step === 1 && !startAtIntro}>
            Précédent
          </button>
          <div className="flex flex-wrap gap-2">
            {!submitted && <SubmitButton variant="secondary" name="intent" value="draft">Enregistrer et finir plus tard</SubmitButton>}
            {step < total ? (
              <button type="button" onClick={next} className="btn btn-primary px-6">Suivant</button>
            ) : (
              <SubmitButton name="intent" value="submit" className="px-6">{submitted ? "Enregistrer les modifications" : "Envoyer à mon équipe"}</SubmitButton>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
