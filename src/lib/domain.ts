export type Profession =
  | "medecin"
  | "kine"
  | "osteo"
  | "podologue"
  | "dieteticien"
  | "sophrologue"
  | "chiropracteur"
  | "psychologue";
export type StepOwner = Profession | "patient" | "coordinateur";
export type Offer = "bilan" | "parcours";
export type Phase = "bilan" | "parcours";
export type EnrollmentStatus = "actif" | "en_pause" | "termine";
export type StepStatus = "a_venir" | "en_cours" | "realisee" | "non_retenue";
export type SessionStatus = "prevue" | "realisee" | "annulee";
export type NoteVisibility = "equipe" | "privee" | "patient";
export type TeamStatus = "proposee" | "acceptee" | "refusee";

export const ALL_PROFESSIONS: Profession[] = [
  "medecin", "kine", "osteo", "podologue", "dieteticien", "sophrologue", "chiropracteur", "psychologue",
];

export const PROFESSION_LABEL: Record<StepOwner, string> = {
  patient: "Patient",
  coordinateur: "Coordination Via Sana",
  medecin: "Médecin",
  kine: "Kinésithérapeute",
  osteo: "Ostéopathe",
  podologue: "Podologue",
  dieteticien: "Diététicien·ne",
  sophrologue: "Sophrologue",
  chiropracteur: "Chiropracteur",
  psychologue: "Psychologue",
};

export const PROFESSION_SHORT: Record<Profession, string> = {
  medecin: "Méd.",
  kine: "Kiné",
  osteo: "Ostéo",
  podologue: "Podo.",
  dieteticien: "Diét.",
  sophrologue: "Sophro.",
  chiropracteur: "Chiro.",
  psychologue: "Psy.",
};

export const OFFER_LABEL: Record<Offer, string> = {
  bilan: "Bilan de course",
  parcours: "Parcours coordonné",
};

export const PHASE_LABEL: Record<Phase, string> = {
  bilan: "Bilan de course",
  parcours: "Parcours coordonné",
};

export const ENROLLMENT_STATUS_LABEL: Record<EnrollmentStatus, string> = {
  actif: "Actif",
  en_pause: "En pause",
  termine: "Terminé",
};

export const STEP_STATUS_LABEL: Record<StepStatus, string> = {
  a_venir: "À venir",
  en_cours: "En cours",
  realisee: "Réalisée",
  non_retenue: "Non retenue",
};

export const NOTE_VISIBILITY_LABEL: Record<NoteVisibility, string> = {
  equipe: "Équipe de soins",
  privee: "Privée (moi seul·e)",
  patient: "Visible par le patient",
};

/** Price shown to the patient when choosing the coordinated pathway (from prepamarathon.com). */
export const COORDINATION_OFFER = { price: "150 €", months: 6 };

// The six dimensions examined during the "bilan de course" (prepamarathon.com).
export const BILAN_DIMENSIONS = [
  { id: "antecedents", label: "Antécédents de coureur" },
  { id: "volume", label: "Volume et programme de course" },
  { id: "objectif", label: "Objectif et planification" },
  { id: "douleurs", label: "Douleurs et gênes, présentes ou passées" },
  { id: "appuis", label: "Appuis et foulée" },
  { id: "desequilibres", label: "Déséquilibres fonctionnels à surveiller" },
] as const;

// Pre-bilan questionnaire, modelled on PrépaMarathon's own form (Eval&GO):
// "Anamnèse médicale" in five parts, then "Profil coureur & habitudes".
// Each section declares who needs it: a practitioner only sees the sections
// strictly necessary to their part of the care (CSP L1110-4), and the
// coordinator — not a health professional — only sees the race and the
// organisation. The physio who runs the bilan reads the whole medical part.
// The patient always sees everything.
export type Audience = Profession | "coordinateur";

type FieldBase = { id: string; label: string; hint?: string; required?: boolean };

export type IntakeField =
  | (FieldBase & { type: "text" | "textarea" | "date"; placeholder?: string })
  | (FieldBase & { type: "number"; unit?: string; min?: number; max?: number })
  | (FieldBase & { type: "range"; unit?: string; min: number; max: number })
  | (FieldBase & { type: "choice"; options: string[]; multiple?: boolean; columns?: 1 | 2 });

export type IntakeSection = {
  id: string;
  group: string;
  title: string;
  audience: Audience[];
  fields: IntakeField[];
};

const ANAMNESE = "Anamnèse médicale";
const PROFIL = "Profil coureur & habitudes";
const ORGA = "Organisation";
const MUSCULO: Profession[] = ["medecin", "kine", "osteo", "podologue", "chiropracteur"];
const YES_NO = ["Oui", "Non"];

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    id: "cardio",
    group: ANAMNESE,
    title: "1. Votre santé cardiovasculaire",
    audience: ["medecin", "kine"],
    fields: [
      { id: "atcd_familiaux_cardio", label: "Avez-vous des antécédents familiaux de maladie cardiaque (parents, frères, sœurs) ?", type: "choice", options: ["Oui", "Non", "Je ne sais pas"], required: true },
      { id: "douleur_thoracique", label: "Avez-vous déjà ressenti une douleur ou une oppression thoracique à l'effort ?", type: "choice", options: ["Jamais", "Une fois", "Plusieurs fois"], required: true },
      { id: "malaise_effort", label: "Avez-vous déjà eu un malaise, une syncope ou un « voile noir » pendant ou juste après un effort ?", type: "choice", options: YES_NO, required: true },
      { id: "palpitations", label: "Ressentez-vous parfois des palpitations (cœur qui s'emballe ou qui saute des battements) au repos ou à l'effort ?", type: "choice", options: ["Jamais", "Rarement", "Fréquemment"], required: true },
      { id: "essoufflement", label: "Vous arrive-t-il d'être essoufflé(e) de manière disproportionnée par rapport à votre effort ?", hint: "Intensité anormale ou différente de d'habitude", type: "choice", options: ["Jamais", "Parfois", "Souvent"], required: true },
      { id: "facteurs_risque", label: "Avez-vous une hypertension (HTA), un diabète ou un cholestérol élevé connu ?", hint: "Plusieurs réponses possibles", type: "choice", options: ["Aucun", "HTA", "Diabète", "Cholestérol élevé"], multiple: true, required: true },
      { id: "tabac", label: "Consommez-vous du tabac ou la cigarette électronique ?", type: "choice", options: ["Non", "J'ai arrêté récemment", "Oui, la cigarette électronique", "Oui, régulièrement"], columns: 2, required: true },
    ],
  },
  {
    id: "respiratoire",
    group: ANAMNESE,
    title: "2. Votre santé respiratoire",
    audience: ["medecin", "kine"],
    fields: [
      { id: "asthme", label: "Avez-vous un asthme connu ou avez-vous déjà utilisé de la Ventoline ?", type: "choice", options: ["Oui, asthme connu", "Seulement déjà eu besoin de Ventoline", "Non"], required: true },
      { id: "toux_effort", label: "Avez-vous une toux sèche pendant ou après vos sorties de course, surtout par temps froid ou sec ?", type: "choice", options: ["Jamais", "Parfois", "Systématiquement"], required: true },
    ],
  },
  {
    id: "musculo",
    group: ANAMNESE,
    title: "3. Bilan musculo-squelettique",
    audience: MUSCULO,
    fields: [
      { id: "douleur_course", label: "Avez-vous actuellement une douleur ou une gêne qui persiste quand vous courez ?", type: "choice", options: ["Aucune douleur", "Oui, mais elle disparaît en courant", "Oui, elle s'aggrave en courant", "Oui, elle m'empêche de courir"], required: true },
      { id: "zones_douleur", label: "Si oui, pouvez-vous localiser cette douleur ?", hint: "Plusieurs réponses possibles", type: "choice", options: ["Pied / cheville", "Tibia / mollet", "Genou", "Cuisse / ischio-jambiers", "Hanche / bassin", "Dos lombaire", "Autre"], multiple: true, columns: 2 },
      { id: "arret_blessure", label: "Au cours des 12 derniers mois, avez-vous dû arrêter de courir plus de 2 semaines consécutives à cause d'une douleur ou d'une blessure ?", type: "choice", options: YES_NO, required: true },
      { id: "raideurs", label: "Ressentez-vous habituellement des raideurs ou des limitations de mouvement dans certaines zones ?", hint: "Plusieurs réponses possibles", type: "choice", options: ["Aucune", "Chevilles", "Hanches", "Bas du dos", "Genoux", "Épaules / haut du dos"], multiple: true, required: true },
      { id: "semelles", label: "Portez-vous des semelles orthopédiques pour courir ?", type: "choice", options: ["Oui, tout le temps", "Parfois", "Non"], required: true },
      { id: "anti_inflammatoires", label: "Vous arrive-t-il de prendre des anti-inflammatoires ou des antalgiques (ex : Ibuprofène, Advil, Voltarène, Paracétamol) avant ou après une course pour gérer une douleur ?", type: "choice", options: ["Jamais", "Exceptionnellement", "Régulièrement"], required: true },
      { id: "autres_blessures", label: "Avez-vous d'autres antécédents de blessures à partager à vos praticiens ?", hint: "Donnez le plus de détails possibles", type: "textarea" },
    ],
  },
  {
    id: "metabolique",
    group: ANAMNESE,
    title: "4. Votre santé métabolique & biologique",
    audience: ["medecin", "kine", "dieteticien"],
    fields: [
      { id: "poids", label: "Quel est votre poids ?", type: "number", unit: "kg", min: 30, max: 200, required: true },
      { id: "taille", label: "Quelle est votre taille ?", type: "number", unit: "cm", min: 120, max: 220, required: true },
      { id: "regime", label: "Suivez-vous un régime alimentaire particulier ?", type: "choice", options: ["Aucun", "Végétarien", "Vegan", "Sans gluten", "Sans lactose", "Low-carb"], required: true },
      { id: "fatigue_chronique", label: "Ressentez-vous une fatigue chronique ou une baisse de performances malgré un entraînement maintenu ?", type: "choice", options: ["Non", "Un peu, depuis quelques semaines", "Oui, depuis plus d'un mois"], required: true },
      { id: "fracture_fatigue", label: "Avez-vous déjà eu une fracture de fatigue (stress fracture) ?", type: "choice", options: YES_NO },
    ],
  },
  {
    id: "antecedents",
    group: ANAMNESE,
    title: "5. Antécédents généraux",
    audience: ["medecin", "kine", "osteo", "chiropracteur"],
    fields: [
      { id: "chirurgie", label: "Avez-vous subi des interventions chirurgicales (en lien ou non avec le sport) ?", type: "choice", options: ["Non", "Oui"], required: true },
      { id: "autres_antecedents", label: "Avez-vous des antécédents médicaux importants non mentionnés précédemment ?", hint: "Ex : épilepsie, maladie auto-immune, trouble de la coagulation…", type: "textarea" },
      { id: "medicaments", label: "Prenez-vous actuellement des médicaments au quotidien ?", type: "choice", options: ["Non", "Oui"], required: true },
    ],
  },
  {
    id: "charge",
    group: PROFIL,
    title: "1. Votre charge d'entraînement",
    audience: ALL_PROFESSIONS,
    fields: [
      { id: "km_semaine", label: "Quel est votre volume d'entraînement moyen en course à pied ?", type: "range", unit: "km/semaine", min: 0, max: 100 },
      { id: "anciennete", label: "Depuis combien de temps courez-vous régulièrement ?", type: "choice", options: ["Moins de 6 mois", "6 mois à 2 ans", "Plus de 2 ans"], required: true },
      { id: "renforcement", label: "Pratiquez-vous du renforcement musculaire ou des entraînements croisés ?", hint: "Plusieurs réponses possibles", type: "choice", options: ["Aucun", "Renforcement musculaire / PPG", "Vélo / Cyclisme", "Natation", "Yoga / Mobilité"], multiple: true, required: true },
      { id: "objectif", label: "Quel est votre objectif actuel en course à pied ?", type: "choice", options: ["Courir pour le plaisir / la santé", "Préparer une course (5K-10K)", "Préparer un semi-marathon, marathon ou trail", "Reprendre après une blessure ou un arrêt"], required: true },
    ],
  },
  {
    id: "course",
    group: PROFIL,
    title: "2. Votre course",
    audience: ["coordinateur", ...ALL_PROFESSIONS],
    fields: [
      { id: "course", label: "Quelle course préparez-vous ?", type: "text", placeholder: "Marathon de Paris" },
      { id: "date_course", label: "À quelle date ?", type: "date" },
      { id: "temps_vise", label: "Quel temps visez-vous ?", type: "text", placeholder: "3h45" },
    ],
  },
  {
    id: "organisation",
    group: ORGA,
    title: "Votre bilan en pratique",
    audience: ["coordinateur", ...ALL_PROFESSIONS],
    fields: [
      { id: "ordonnance", label: "Avez-vous une ordonnance de kinésithérapie ?", hint: "Elle permet le remboursement du bilan. Sinon, une téléconsultation médicale vous sera proposée.", type: "choice", options: YES_NO, required: true },
      { id: "medecin_traitant", label: "Qui est votre médecin traitant ?", type: "text", placeholder: "Dr …" },
      { id: "disponibilites", label: "Quand êtes-vous disponible pour vos rendez-vous ?", type: "choice", options: ["En semaine, journée", "En semaine, soir", "Week-end", "Flexible"], columns: 2 },
    ],
  },
];

export type IntakeValue = string | number | string[] | null;
export type IntakeAnswers = Record<string, IntakeValue>;

export function visibleSectionsFor(viewer: Audience | "patient"): IntakeSection[] {
  if (viewer === "patient") return INTAKE_SECTIONS;
  return INTAKE_SECTIONS.filter((s) => s.audience.includes(viewer));
}

/**
 * Answers that call for a medical opinion before the effort, or a closer look
 * at the bilan. Only shown to the professions that can see those sections.
 */
export function intakeRedFlags(a: IntakeAnswers): { section: string; label: string }[] {
  const flags: { section: string; label: string }[] = [];
  const is = (id: string, ...values: string[]) => typeof a[id] === "string" && values.includes(a[id] as string);
  if (is("douleur_thoracique", "Une fois", "Plusieurs fois")) flags.push({ section: "cardio", label: `Douleur thoracique à l'effort (${String(a.douleur_thoracique).toLowerCase()})` });
  if (is("malaise_effort", "Oui")) flags.push({ section: "cardio", label: "Malaise ou syncope à l'effort" });
  if (is("palpitations", "Fréquemment")) flags.push({ section: "cardio", label: "Palpitations fréquentes" });
  if (is("essoufflement", "Souvent")) flags.push({ section: "cardio", label: "Essoufflement disproportionné fréquent" });
  if (is("atcd_familiaux_cardio", "Oui")) flags.push({ section: "cardio", label: "Antécédents familiaux cardiaques" });
  if (is("douleur_course", "Oui, elle s'aggrave en courant", "Oui, elle m'empêche de courir")) flags.push({ section: "musculo", label: `Douleur : ${String(a.douleur_course).replace("Oui, ", "").toLowerCase()}` });
  if (is("anti_inflammatoires", "Régulièrement")) flags.push({ section: "musculo", label: "Anti-inflammatoires réguliers autour des courses" });
  if (is("fatigue_chronique", "Oui, depuis plus d'un mois")) flags.push({ section: "metabolique", label: "Fatigue chronique depuis plus d'un mois" });
  return flags;
}

/** Cardiovascular warning signs: the medical teleconsultation is kept even with a prescription. */
export function needsMedicalOpinion(a: IntakeAnswers) {
  return intakeRedFlags(a).some((f) => f.section === "cardio");
}
