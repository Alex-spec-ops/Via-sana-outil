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

// Pre-bilan questionnaire. Each section declares who needs it: a practitioner
// only sees the sections strictly necessary to their part of the care (CSP
// L1110-4), and the coordinator — not a health professional — only sees the
// logistics section. The patient always sees everything.
export type Audience = Profession | "coordinateur";

export type IntakeField =
  | { id: string; label: string; type: "text" | "textarea" | "date"; placeholder?: string }
  | { id: string; label: string; type: "number"; unit?: string; min?: number; max?: number }
  | { id: string; label: string; type: "select"; options: string[] }
  | { id: string; label: string; type: "boolean" };

export type IntakeSection = {
  id: string;
  title: string;
  audience: Audience[];
  fields: IntakeField[];
};

const MUSCULO: Profession[] = ["medecin", "kine", "osteo", "podologue", "chiropracteur"];

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    id: "organisation",
    title: "Organisation",
    audience: ["coordinateur", ...ALL_PROFESSIONS],
    fields: [
      { id: "ordonnance", label: "J'ai une ordonnance de kinésithérapie", type: "boolean" },
      { id: "medecin_traitant", label: "Médecin traitant", type: "text", placeholder: "Dr …" },
      {
        id: "disponibilites",
        label: "Disponibilités",
        type: "select",
        options: ["En semaine, journée", "En semaine, soir", "Week-end", "Flexible"],
      },
    ],
  },
  {
    id: "objectif",
    title: "Objectif et planification",
    audience: ALL_PROFESSIONS,
    fields: [
      { id: "course", label: "Course visée", type: "text", placeholder: "Marathon de Paris" },
      { id: "date_course", label: "Date de la course", type: "date" },
      { id: "temps_vise", label: "Temps visé", type: "text", placeholder: "3h45" },
      {
        id: "niveau",
        label: "Niveau de pratique",
        type: "select",
        options: ["Débutant (< 1 an)", "Intermédiaire (1–3 ans)", "Confirmé (> 3 ans)"],
      },
    ],
  },
  {
    id: "volume",
    title: "Historique et volume de course",
    audience: ["medecin", "kine", "osteo", "podologue", "dieteticien", "chiropracteur"],
    fields: [
      { id: "km_semaine", label: "Volume actuel", type: "number", unit: "km/semaine", min: 0, max: 250 },
      { id: "seances_semaine", label: "Séances par semaine", type: "number", min: 0, max: 14 },
      { id: "deja_marathon", label: "Déjà couru un marathon", type: "boolean" },
      { id: "programme", label: "Programme suivi", type: "text", placeholder: "Plan 16 semaines, club, application…" },
    ],
  },
  {
    id: "sante",
    title: "Antécédents médicaux et traitements",
    audience: MUSCULO,
    fields: [
      { id: "antecedents", label: "Antécédents médicaux", type: "textarea" },
      { id: "cardio", label: "Antécédents cardiaques personnels ou familiaux", type: "boolean" },
      { id: "traitements", label: "Traitements en cours", type: "textarea" },
    ],
  },
  {
    id: "douleurs",
    title: "Douleurs et gênes",
    audience: MUSCULO,
    fields: [
      { id: "blessures", label: "Blessures passées (12 derniers mois)", type: "textarea" },
      { id: "douleur_actuelle", label: "Douleur actuelle (0 = aucune, 10 = maximale)", type: "number", min: 0, max: 10 },
      { id: "zone_douleur", label: "Zone de la douleur", type: "text" },
    ],
  },
  {
    id: "appuis",
    title: "Appuis et équipement",
    audience: ["kine", "osteo", "podologue", "chiropracteur"],
    fields: [
      { id: "chaussures", label: "Chaussures de course", type: "text", placeholder: "Modèle, kilométrage" },
      { id: "semelles", label: "Semelles orthopédiques", type: "boolean" },
      { id: "surface", label: "Surface habituelle", type: "select", options: ["Route", "Chemin / trail", "Piste", "Tapis", "Mixte"] },
    ],
  },
  {
    id: "nutrition",
    title: "Alimentation et hydratation",
    audience: ["medecin", "dieteticien"],
    fields: [
      { id: "poids", label: "Poids", type: "number", unit: "kg", min: 30, max: 200 },
      { id: "taille", label: "Taille", type: "number", unit: "cm", min: 120, max: 220 },
      { id: "regime", label: "Régime alimentaire", type: "select", options: ["Omnivore", "Végétarien", "Végétalien", "Sans gluten", "Autre"] },
      { id: "troubles_digestifs", label: "Troubles digestifs à l'effort", type: "boolean" },
    ],
  },
  {
    id: "mental",
    title: "Sommeil, stress et motivation",
    audience: ["medecin", "sophrologue", "psychologue"],
    fields: [
      { id: "sommeil", label: "Heures de sommeil par nuit", type: "number", min: 0, max: 14 },
      { id: "stress", label: "Niveau de stress (0 à 10)", type: "number", min: 0, max: 10 },
      { id: "attentes", label: "Vos attentes vis-à-vis de l'accompagnement", type: "textarea" },
    ],
  },
];

export type IntakeAnswers = Record<string, string | number | boolean | null>;

export function visibleSectionsFor(viewer: Audience | "patient"): IntakeSection[] {
  if (viewer === "patient") return INTAKE_SECTIONS;
  return INTAKE_SECTIONS.filter((s) => s.audience.includes(viewer));
}
