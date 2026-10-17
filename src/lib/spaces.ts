// The three spaces of the tool, each with its own login page. A login page
// only accepts accounts of its own kind (see loginWithPassword).

export type SpaceSlug = "patient" | "praticien" | "coordination";
export type UserType = "patient" | "practitioner" | "coordinator";

export const SPACES: Record<SpaceSlug, { userType: UserType; home: string; login: string; label: string }> = {
  patient: { userType: "patient", home: "/patient", login: "/connexion/patient", label: "Espace coureur" },
  praticien: { userType: "practitioner", home: "/praticien", login: "/connexion/praticien", label: "Espace praticiens partenaires" },
  coordination: { userType: "coordinator", home: "/coordination", login: "/connexion/coordination", label: "Espace coordination Via Sana" },
};

export const isSpace = (value: string): value is SpaceSlug => value in SPACES;

/** Where each kind of account lands, and where it logs in. */
export const HOME: Record<UserType, string> = { patient: "/patient", practitioner: "/praticien", coordinator: "/coordination" };
export const LOGIN: Record<UserType, string> = {
  patient: SPACES.patient.login,
  practitioner: SPACES.praticien.login,
  coordinator: SPACES.coordination.login,
};
