const TZ = "Europe/Paris";

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString("fr-FR", { timeZone: TZ, ...opts });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

export function age(birthDate: string) {
  const b = new Date(`${birthDate}T12:00:00`);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years--;
  return years;
}

export function daysUntil(iso: string | null) {
  if (!iso) return null;
  const target = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).getTime();
  return Math.round((target - Date.now()) / (24 * 60 * 60 * 1000));
}

export function weekOfPathway(startDate: string) {
  const days = Math.floor((Date.now() - new Date(`${startDate}T00:00:00`).getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.floor(days / 7));
}

export function fullName(p: { title?: string | null; first_name: string; last_name: string }) {
  return [p.title, p.first_name, p.last_name].filter(Boolean).join(" ");
}

export function initials(p: { first_name: string; last_name: string }) {
  return `${p.first_name[0] ?? ""}${p.last_name[0] ?? ""}`.toUpperCase();
}

export const ACTION_LABEL: Record<string, string> = {
  consultation_fiche: "a consulté le dossier",
  consultation_logistique: "a consulté l'organisation du parcours",
  lecture_compte_rendu: "a lu le compte rendu",
  lecture_partage_externe: "a ouvert le bilan partagé",
  redaction_compte_rendu: "a rédigé le compte rendu",
  ajout_note: "a ajouté une note de suivi",
  mise_a_jour_etape: "a mis à jour une étape",
  etape_non_retenue: "a retiré une étape optionnelle",
  ajout_etape: "a ajouté une étape au parcours",
  proposition_praticien: "a proposé un praticien",
  planification_seance: "a planifié une séance",
  mise_a_jour_seance: "a mis à jour une séance",
  relance: "a relancé le patient",
  changement_statut_parcours: "a changé le statut du parcours",
  connexion: "s'est connecté·e",
  envoi_formulaire: "a envoyé le questionnaire",
  brouillon_formulaire: "a enregistré un brouillon du questionnaire",
  choix_parcours_coordonne: "a choisi le parcours coordonné",
  choix_arret_bilan: "a choisi de s'arrêter au bilan",
  acceptation_praticien: "a accepté un praticien dans son équipe",
  refus_praticien: "a refusé un praticien proposé",
  partage_externe: "a partagé son bilan hors de l'équipe",
  revocation_partage: "a révoqué un partage",
  opposition_partage: "s'est opposé·e au partage entre praticiens",
  levee_opposition_partage: "a autorisé le partage entre praticiens",
};

// The patient's own actions, as shown to them ("Vous …").
export const SELF_ACTION_LABEL: Record<string, string> = {
  connexion: "vous êtes connecté·e",
  envoi_formulaire: "avez envoyé le questionnaire",
  brouillon_formulaire: "avez enregistré un brouillon du questionnaire",
  choix_parcours_coordonne: "avez choisi le parcours coordonné",
  choix_arret_bilan: "avez choisi de vous arrêter au bilan",
  acceptation_praticien: "avez accepté un praticien dans votre équipe",
  refus_praticien: "avez refusé un praticien proposé",
  partage_externe: "avez partagé votre bilan hors de l'équipe",
  revocation_partage: "avez révoqué un partage",
  opposition_partage: "vous êtes opposé·e au partage entre praticiens",
  levee_opposition_partage: "avez autorisé le partage entre praticiens",
  lecture_compte_rendu: "avez consulté votre compte rendu",
};
