// The two login pages of the tool. Runners log in on theirs; health
// professionals and the Via Sana coordination share the professionals' page.
// A login page only accepts the accounts it lists (see loginWithPassword).

export type SpaceSlug = "patient" | "praticien";
export type UserType = "patient" | "practitioner" | "coordinator";

export const SPACES: Record<SpaceSlug, { userTypes: UserType[]; login: string; label: string }> = {
  patient: { userTypes: ["patient"], login: "/connexion/patient", label: "Espace coureur" },
  praticien: { userTypes: ["practitioner", "coordinator"], login: "/connexion/praticien", label: "Espace praticiens partenaires et coordination" },
};

export const isSpace = (value: string): value is SpaceSlug => value in SPACES;

/** Where each kind of account lands, and where it logs in. */
export const HOME: Record<UserType, string> = { patient: "/patient", practitioner: "/praticien", coordinator: "/coordination" };
export const LOGIN: Record<UserType, string> = {
  patient: SPACES.patient.login,
  practitioner: SPACES.praticien.login,
  coordinator: SPACES.praticien.login,
};
