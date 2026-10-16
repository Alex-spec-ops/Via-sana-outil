export type Profession = "medecin" | "kine" | "osteo" | "dieteticien";
export type StepOwner = Profession | "patient";
export type EnrollmentStatus = "actif" | "en_pause" | "termine";
export type StepStatus = "a_venir" | "en_cours" | "realisee";
export type SessionStatus = "prevue" | "realisee" | "annulee";
export type NoteVisibility = "equipe" | "privee" | "patient";

export const PROFESSION_LABEL: Record<StepOwner, string> = {
  patient: "Patient",
  medecin: "Médecin généraliste",
  kine: "Kinésithérapeute",
  osteo: "Ostéopathe",
  dieteticien: "Diététicien·ne",
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
};

export const NOTE_VISIBILITY_LABEL: Record<NoteVisibility, string> = {
  equipe: "Équipe de soins",
  privee: "Privée (moi seul·e)",
  patient: "Visible par le patient",
};

// Pre-pathway questionnaire. Each section declares which professions need it:
// a practitioner only sees the sections strictly necessary to their part of
// the care (CSP L1110-4, II and III). The patient always sees all of it.
export type IntakeField =
  | { id: string; label: string; type: "text" | "textarea" | "date"; placeholder?: string }
  | { id: string; label: string; type: "number"; unit?: string; min?: number; max?: number }
  | { id: string; label: string; type: "select"; options: string[] }
  | { id: string; label: string; type: "boolean" };

export type IntakeSection = {
  id: string;
  title: string;
  audience: Profession[];
  fields: IntakeField[];
};

export const ALL_PROFESSIONS: Profession[] = ["medecin", "kine", "osteo", "dieteticien"];

export const INTAKE_SECTIONS: IntakeSection[] = [
  {
    id: "objectif",
    title: "Objectif et entraînement",
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
      { id: "km_semaine", label: "Volume actuel", type: "number", unit: "km/semaine", min: 0, max: 250 },
      { id: "seances_semaine", label: "Séances par semaine", type: "number", min: 0, max: 14 },
      { id: "deja_marathon", label: "Déjà couru un marathon", type: "boolean" },
    ],
  },
  {
    id: "sante",
    title: "Antécédents médicaux et traitements",
    audience: ["medecin", "kine", "osteo"],
    fields: [
      { id: "antecedents", label: "Antécédents médicaux", type: "textarea" },
      { id: "cardio", label: "Antécédents cardiaques personnels ou familiaux", type: "boolean" },
      { id: "traitements", label: "Traitements en cours", type: "textarea" },
      { id: "allergies", label: "Allergies", type: "text" },
    ],
  },
  {
    id: "blessures",
    title: "Blessures et douleurs",
    audience: ["medecin", "kine", "osteo"],
    fields: [
      { id: "blessures", label: "Blessures passées (12 derniers mois)", type: "textarea" },
      { id: "douleur_actuelle", label: "Douleur actuelle (0 = aucune, 10 = maximale)", type: "number", min: 0, max: 10 },
      { id: "zone_douleur", label: "Zone de la douleur", type: "text" },
    ],
  },
  {
    id: "nutrition",
    title: "Alimentation et hydratation",
    audience: ["medecin", "dieteticien"],
    fields: [
      { id: "poids", label: "Poids", type: "number", unit: "kg", min: 30, max: 200 },
      { id: "taille", label: "Taille", type: "number", unit: "cm", min: 120, max: 220 },
      {
        id: "regime",
        label: "Régime alimentaire",
        type: "select",
        options: ["Omnivore", "Végétarien", "Végétalien", "Sans gluten", "Autre"],
      },
      { id: "troubles_digestifs", label: "Troubles digestifs à l'effort", type: "boolean" },
      { id: "habitudes", label: "Habitudes alimentaires / hydratation", type: "textarea" },
    ],
  },
  {
    id: "mode_de_vie",
    title: "Sommeil et mode de vie",
    audience: ALL_PROFESSIONS,
    fields: [
      { id: "sommeil", label: "Heures de sommeil par nuit", type: "number", min: 0, max: 14 },
      { id: "activite_pro", label: "Activité professionnelle", type: "text", placeholder: "Sédentaire, debout, physique…" },
      { id: "attentes", label: "Vos attentes vis-à-vis de l'accompagnement", type: "textarea" },
    ],
  },
];

export type IntakeAnswers = Record<string, string | number | boolean | null>;

export function visibleSectionsFor(profession: Profession | "patient"): IntakeSection[] {
  if (profession === "patient") return INTAKE_SECTIONS;
  return INTAKE_SECTIONS.filter((s) => s.audience.includes(profession));
}
