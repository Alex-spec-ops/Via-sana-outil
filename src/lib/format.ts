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
  ajout_note: "a ajouté une note de suivi",
  mise_a_jour_etape: "a mis à jour une étape",
  planification_seance: "a planifié une séance",
  mise_a_jour_seance: "a mis à jour une séance",
  changement_statut_parcours: "a changé le statut du parcours",
  connexion: "s'est connecté·e",
  envoi_formulaire: "a envoyé le formulaire préalable",
  brouillon_formulaire: "a enregistré un brouillon du formulaire",
  opposition_partage: "s'est opposé·e au partage entre praticiens",
  levee_opposition_partage: "a autorisé le partage entre praticiens",
};

// The patient's own actions, as shown to them ("Vous …").
export const SELF_ACTION_LABEL: Record<string, string> = {
  connexion: "vous êtes connecté·e",
  envoi_formulaire: "avez envoyé le formulaire préalable",
  brouillon_formulaire: "avez enregistré un brouillon du formulaire",
  opposition_partage: "vous êtes opposé·e au partage entre praticiens",
  levee_opposition_partage: "avez autorisé le partage entre praticiens",
};
