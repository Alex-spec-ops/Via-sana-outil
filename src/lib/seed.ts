import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { IntakeAnswers } from "./domain";
import { instantiatePhase } from "./pathway";

// 100 % fictional demo data, modelled on the PrépaMarathon offer
// (prepamarathon.com). Dates are relative to the moment the database is
// created, so the demo always shows a realistic "today".

const DAY = 24 * 60 * 60 * 1000;

function at(base: number, days: number, hour = 10, minute = 0) {
  const d = new Date(base + days * DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Same as `at`, moved to the next Monday when it falls on a weekend (appointments). */
function weekdayAt(base: number, days: number, hour = 10, minute = 0) {
  const d = new Date(at(base, days, hour, minute));
  const shift = d.getDay() === 6 ? 2 : d.getDay() === 0 ? 1 : 0;
  return shift ? at(base, days + shift, hour, minute) : d.toISOString();
}

function dateOnly(base: number, days: number) {
  return at(base, days, 12).slice(0, 10);
}

const COORDINATOR = { id: "co-fontaine", first: "Lucie", last: "Fontaine" };

const PRACTITIONERS = [
  { id: "pr-petit", first: "Julien", last: "Petit", title: "", profession: "kine", specialty: "Kiné du sport · bilans de course", location: "Centre partenaire, Paris 9e" },
  { id: "pr-roux", first: "Nadia", last: "Roux", title: "", profession: "kine", specialty: "Kiné du sport", location: "Paris 11e" },
  { id: "pr-morel", first: "Claire", last: "Morel", title: "Dr", profession: "medecin", specialty: "Médecine du sport", location: "Paris 9e · téléconsultation" },
  { id: "pr-benali", first: "Sarah", last: "Benali", title: "", profession: "osteo", specialty: "Ostéopathie du sport", location: "Paris 10e" },
  { id: "pr-nguyen", first: "Camille", last: "Nguyen", title: "", profession: "podologue", specialty: "Podologie du sport", location: "Paris 9e" },
  { id: "pr-lefevre", first: "Thomas", last: "Lefèvre", title: "", profession: "dieteticien", specialty: "Nutrition sportive", location: "Paris 17e" },
  { id: "pr-garcia", first: "Léo", last: "Garcia", title: "", profession: "sophrologue", specialty: "Préparation mentale", location: "Paris 2e" },
  { id: "pr-aubert", first: "Marion", last: "Aubert", title: "", profession: "psychologue", specialty: "Psychologie du sport", location: "Téléconsultation" },
] as const;

const PATHWAY = {
  id: "pw-prepa",
  name: "PrépaMarathon",
  description:
    "Un bilan de course avec un kinésithérapeute du sport, puis, si le patient le souhaite, un parcours coordonné de 6 mois avec une équipe pluridisciplinaire.",
  steps: [
    { phase: "bilan", title: "Questionnaire en ligne", description: "5 minutes : historique de course, objectif, gênes. Le kiné le lit avant le bilan.", profession: "patient", week: 0, optional: 0 },
    { phase: "bilan", title: "Téléconsultation médecin", description: "Avis médical avant le bilan, et ordonnance si le patient n'en a pas.", profession: "medecin", week: 0, optional: 1 },
    { phase: "bilan", title: "Bilan de course (30 min)", description: "Antécédents, volume d'entraînement, douleurs, appuis, bilan fonctionnel complet.", profession: "kine", week: 1, optional: 0 },
    { phase: "bilan", title: "Plan d'action remis", description: "Compte rendu PDF : observations du kiné et recommandations.", profession: "kine", week: 1, optional: 0 },
    { phase: "bilan", title: "Choix de la suite", description: "S'arrêter au bilan, ou poursuivre avec le parcours coordonné.", profession: "patient", week: 2, optional: 0 },
    { phase: "parcours", title: "Analyse de foulée sur tapis", description: "Cadence, appuis, attaque du pied, asymétries vérifiés en mouvement.", profession: "kine", week: 3, optional: 1 },
    { phase: "parcours", title: "Composition de l'équipe", description: "Selon les besoins du bilan, le coordinateur propose les praticiens ; le patient valide.", profession: "coordinateur", week: 3, optional: 0 },
    { phase: "parcours", title: "Bilan de fin de parcours", description: "Débrief de la course, récupération, suites à donner.", profession: "kine", week: 24, optional: 0 },
  ],
};

const CATALOG = [
  { id: "cat-aptitude", title: "Consultation d'aptitude", description: "Examen clinique et cardiovasculaire, certificat de non contre-indication.", profession: "medecin" },
  { id: "cat-podo", title: "Bilan podologique", description: "Analyse des appuis, semelles si besoin.", profession: "podologue" },
  { id: "cat-diet", title: "Bilan diététique", description: "Apports adaptés à la charge d'entraînement.", profession: "dieteticien" },
  { id: "cat-diet-course", title: "Stratégie nutritionnelle de course", description: "Recharge glucidique, ravitaillements, tests à l'entraînement.", profession: "dieteticien" },
  { id: "cat-osteo", title: "Séance d'ostéopathie", description: "Mobilité articulaire et tissulaire.", profession: "osteo" },
  { id: "cat-kine-mi", title: "Point mi-parcours kiné", description: "Réévaluation et ajustement du renforcement.", profession: "kine" },
  { id: "cat-kine-renfo", title: "Séance de renforcement", description: "Travail ciblé sur les déséquilibres du bilan.", profession: "kine" },
  { id: "cat-sophro", title: "Préparation mentale", description: "Gestion du stress et visualisation de course.", profession: "sophrologue" },
  { id: "cat-psy", title: "Consultation psychologue du sport", description: "Motivation, rapport à la performance.", profession: "psychologue" },
  { id: "cat-chiro", title: "Séance de chiropraxie", description: "Ajustements vertébraux et articulaires.", profession: "chiropracteur" },
];

type PatientDef = {
  id: string;
  first: string;
  last: string;
  birth: string;
  sex: "F" | "M";
  offer: "bilan" | "parcours";
  status: "actif" | "en_pause" | "termine";
  startDaysAgo: number;
  team: { id: string; status?: "proposee" }[];
  /** Steps added from the catalogue: [catalog id, planned week] */
  added?: [string, number][];
  /** One letter per step, in plan order: R réalisée, N non retenue, E en cours, A à venir */
  states: string;
  noUpcomingSession?: boolean;
  goal: { title: string; detail: string; raceInWeeks?: number };
  opposed?: boolean;
  report?: boolean;
  /** Short patient profile, turned into questionnaire answers by `toAnswers`. */
  intake: Profile | null;
  /** Answers that differ from what the profile implies (demo cases). */
  extra?: IntakeAnswers;
};

type Profile = Record<string, string | number | boolean>;

/** Turns a short fictional profile into answers to the PrépaMarathon questionnaire. */
function toAnswers(p: Profile, raceDate: string, extra: IntakeAnswers = {}): IntakeAnswers {
  const txt = (k: string) => String(p[k] ?? "");
  const has = (k: string, word: string) => txt(k).toLowerCase().includes(word.toLowerCase());
  const pain = Number(p.douleur_actuelle ?? 0);
  const zone = txt("zone_douleur").toLowerCase();
  const zones = [
    [/cheville|achille|pied|métatars/, "Pied / cheville"],
    [/tibia|mollet/, "Tibia / mollet"],
    [/genou/, "Genou"],
    [/lombaire/, "Dos lombaire"],
  ].filter(([re]) => (re as RegExp).test(zone)).map(([, label]) => label as string);
  const injuries = txt("blessures");
  return {
    atcd_familiaux_cardio: p.cardio ? "Oui" : "Non",
    douleur_thoracique: "Jamais",
    malaise_effort: "Non",
    palpitations: "Jamais",
    essoufflement: "Jamais",
    facteurs_risque: has("antecedents", "HTA") ? ["HTA"] : ["Aucun"],
    tabac: "Non",
    asthme: has("antecedents", "asthme") ? "Oui, asthme connu" : "Non",
    toux_effort: has("antecedents", "asthme") ? "Parfois" : "Jamais",
    douleur_course: pain === 0 ? "Aucune douleur" : pain < 3 ? "Oui, mais elle disparaît en courant" : "Oui, elle s'aggrave en courant",
    zones_douleur: pain === 0 ? [] : zones,
    arret_blessure: injuries && !/^(aucune|ras)$/i.test(injuries) ? "Oui" : "Non",
    raideurs: ["Aucune"],
    semelles: p.semelles ? "Oui, tout le temps" : "Non",
    anti_inflammatoires: "Jamais",
    autres_blessures: /^(aucune|ras)$/i.test(injuries) ? "" : injuries,
    poids: (p.poids as number) ?? null,
    taille: (p.taille as number) ?? null,
    regime: ({ Omnivore: "Aucun", Végétalien: "Vegan" } as Record<string, string>)[txt("regime")] ?? (txt("regime") || "Aucun"),
    fatigue_chronique: "Non",
    fracture_fatigue: "Non",
    chirurgie: "Non",
    autres_antecedents: /^(ras|aucun)$/i.test(txt("antecedents")) ? "" : txt("antecedents"),
    medicaments: /^(aucun|ras)?$/i.test(txt("traitements")) ? "Non" : "Oui",
    km_semaine: Math.min(100, Number(p.km_semaine ?? 0)),
    anciennete: has("niveau", "Débutant") ? "Moins de 6 mois" : has("niveau", "Confirmé") ? "Plus de 2 ans" : "6 mois à 2 ans",
    renforcement: ["Renforcement musculaire / PPG"],
    objectif: txt("course") ? "Préparer un semi-marathon, marathon ou trail" : "Courir pour le plaisir / la santé",
    course: txt("course"),
    date_course: raceDate,
    temps_vise: txt("temps_vise"),
    ordonnance: p.ordonnance ? "Oui" : "Non",
    medecin_traitant: txt("medecin_traitant"),
    disponibilites: txt("disponibilites") || "Flexible",
    ...extra,
  };
}

const PATIENTS: PatientDef[] = [
  {
    id: "pa-hugo", first: "Hugo", last: "Lambert", birth: "1996-06-30", sex: "M", offer: "bilan", status: "actif", startDaysAgo: 3,
    team: [{ id: "pr-petit" }], states: "EAAAA", noUpcomingSession: true,
    goal: { title: "Premier marathon", detail: "Course à définir", raceInWeeks: 20 }, intake: null,
  },
  {
    id: "pa-sophie", first: "Sophie", last: "Garnier", birth: "1979-01-22", sex: "F", offer: "bilan", status: "actif", startDaysAgo: 6,
    team: [{ id: "pr-petit" }, { id: "pr-morel" }], states: "REAAA",
    extra: { douleur_thoracique: "Une fois", essoufflement: "Parfois" },
    goal: { title: "Courir le Marathon de Bordeaux", detail: "Objectif finisher", raceInWeeks: 22 },
    intake: {
      ordonnance: false, medecin_traitant: "Dr Bernard", disponibilites: "En semaine, soir", course: "Marathon de Bordeaux", temps_vise: "4h30",
      niveau: "Débutant (< 1 an)", km_semaine: 18, seances_semaine: 2, deja_marathon: false, programme: "Application",
      antecedents: "Hypothyroïdie", cardio: false, traitements: "Lévothyroxine", blessures: "Aucune", douleur_actuelle: 0, zone_douleur: "",
      chaussures: "Neutres, 300 km", semelles: false, surface: "Route", poids: 68, taille: 165, regime: "Omnivore", troubles_digestifs: false,
      sommeil: 7, stress: 5, attentes: "Être bien encadrée pour un premier marathon",
    },
  },
  {
    id: "pa-chloe", first: "Chloé", last: "Bernard", birth: "1993-08-19", sex: "F", offer: "bilan", status: "actif", startDaysAgo: 12,
    team: [{ id: "pr-petit" }], states: "RNRRE", report: true,
    goal: { title: "Marathon de Paris en 3h50", detail: "Deuxième marathon", raceInWeeks: 25 },
    intake: {
      ordonnance: true, medecin_traitant: "Dr Klein", disponibilites: "Week-end", course: "Marathon de Paris", temps_vise: "3h50",
      niveau: "Intermédiaire (1–3 ans)", km_semaine: 35, seances_semaine: 4, deja_marathon: true, programme: "Club",
      antecedents: "RAS", cardio: false, traitements: "Aucun", blessures: "Entorse cheville droite (2025)", douleur_actuelle: 1,
      zone_douleur: "Cheville droite", chaussures: "Stabilité, 500 km", semelles: false, surface: "Mixte", poids: 58, taille: 166,
      regime: "Végétarien", troubles_digestifs: true, sommeil: 7, stress: 4, attentes: "Gagner 10 minutes sans me blesser",
    },
  },
  {
    id: "pa-marc", first: "Marc", last: "Dubois", birth: "1972-02-14", sex: "M", offer: "bilan", status: "termine", startDaysAgo: 30,
    team: [{ id: "pr-petit" }], states: "RNRRR", report: true,
    goal: { title: "Semi-marathon de Paris", detail: "Bilan seul, suivi par son kiné habituel" },
    intake: {
      ordonnance: true, medecin_traitant: "Dr Laurent", disponibilites: "Flexible", course: "Semi de Paris", temps_vise: "1h50",
      niveau: "Confirmé (> 3 ans)", km_semaine: 30, seances_semaine: 3, deja_marathon: true, programme: "Personnel",
      antecedents: "HTA contrôlée", cardio: true, traitements: "Amlodipine", blessures: "Lombalgie chronique", douleur_actuelle: 2,
      zone_douleur: "Lombaires", chaussures: "Amorties", semelles: true, surface: "Route", poids: 80, taille: 178, regime: "Omnivore",
      troubles_digestifs: false, sommeil: 7, stress: 3, attentes: "Courir en sécurité après 50 ans",
    },
  },
  {
    id: "pa-lea", first: "Léa", last: "Martin", birth: "1991-04-12", sex: "F", offer: "parcours", status: "actif", startDaysAgo: 56,
    team: [{ id: "pr-petit" }, { id: "pr-lefevre" }, { id: "pr-benali" }, { id: "pr-nguyen" }, { id: "pr-garcia", status: "proposee" }],
    added: [["cat-podo", 4], ["cat-diet", 4], ["cat-osteo", 6], ["cat-kine-mi", 9], ["cat-diet-course", 12], ["cat-osteo", 16]],
    states: "RNRRRRRRRREAAA", report: true,
    extra: { raideurs: ["Chevilles"], renforcement: ["Renforcement musculaire / PPG", "Yoga / Mobilité"] },
    goal: { title: "Finir le Marathon de Paris en moins de 4h", detail: "Premier marathon", raceInWeeks: 10 },
    intake: {
      ordonnance: true, medecin_traitant: "Dr Ferrand", disponibilites: "En semaine, soir", course: "Marathon de Paris", temps_vise: "3h55",
      niveau: "Intermédiaire (1–3 ans)", km_semaine: 32, seances_semaine: 3, deja_marathon: false, programme: "Plan 16 semaines",
      antecedents: "Asthme d'effort léger", cardio: false, traitements: "Ventoline si besoin", blessures: "Périostite tibiale droite (2025)",
      douleur_actuelle: 1, zone_douleur: "Tibia droit", chaussures: "Neutres, 450 km", semelles: false, surface: "Route", poids: 61,
      taille: 168, regime: "Végétarien", troubles_digestifs: true, sommeil: 7, stress: 6, attentes: "Arriver au bout sans me blesser",
    },
  },
  {
    id: "pa-karim", first: "Karim", last: "Haddad", birth: "1985-09-03", sex: "M", offer: "parcours", status: "actif", startDaysAgo: 70,
    team: [{ id: "pr-roux" }, { id: "pr-morel" }, { id: "pr-benali" }, { id: "pr-lefevre" }],
    added: [["cat-aptitude", 4], ["cat-diet", 5], ["cat-osteo", 7], ["cat-kine-mi", 10], ["cat-diet-course", 12]],
    states: "RRRRRRRRRRREA", report: true,
    goal: { title: "Marathon de Lyon en 3h30", detail: "Troisième marathon, objectif chrono", raceInWeeks: 9 },
    intake: {
      ordonnance: false, medecin_traitant: "Dr Simon", disponibilites: "En semaine, journée", course: "Marathon de Lyon", temps_vise: "3h30",
      niveau: "Confirmé (> 3 ans)", km_semaine: 55, seances_semaine: 5, deja_marathon: true, programme: "Coach en ligne",
      antecedents: "RAS", cardio: true, traitements: "Aucun", blessures: "Tendinopathie d'Achille gauche (2024)", douleur_actuelle: 2,
      zone_douleur: "Achille gauche", chaussures: "Carbone + entraînement", semelles: false, surface: "Route", poids: 74, taille: 180,
      regime: "Omnivore", troubles_digestifs: false, sommeil: 6, stress: 7, attentes: "Optimiser la performance sans rechute",
    },
  },
  {
    id: "pa-ines", first: "Inès", last: "Moreau", birth: "1988-11-08", sex: "F", offer: "parcours", status: "en_pause", startDaysAgo: 49,
    team: [{ id: "pr-petit" }, { id: "pr-morel" }, { id: "pr-lefevre" }, { id: "pr-aubert" }],
    added: [["cat-diet", 4], ["cat-psy", 6], ["cat-kine-mi", 9]],
    states: "RNRRRNRRREA", noUpcomingSession: true,
    extra: { fatigue_chronique: "Oui, depuis plus d'un mois", fracture_fatigue: "Oui", renforcement: ["Aucun"] },
    goal: { title: "Marathon Nice-Cannes", detail: "Parcours en pause : fracture de fatigue métatarsienne", raceInWeeks: 11 },
    report: true,
    intake: {
      ordonnance: true, medecin_traitant: "Dr Petitjean", disponibilites: "Flexible", course: "Nice-Cannes", temps_vise: "3h50",
      niveau: "Intermédiaire (1–3 ans)", km_semaine: 40, seances_semaine: 4, deja_marathon: false, programme: "Club",
      antecedents: "Anémie ferriprive (2023)", cardio: false, traitements: "Fer", blessures: "Aucune", douleur_actuelle: 0, zone_douleur: "",
      chaussures: "Minimalistes", semelles: false, surface: "Route", poids: 55, taille: 170, regime: "Omnivore", troubles_digestifs: false,
      sommeil: 6, stress: 8, attentes: "Progresser en confiance",
    },
  },
  {
    id: "pa-antoine", first: "Antoine", last: "Faure", birth: "1990-03-05", sex: "M", offer: "parcours", status: "actif", startDaysAgo: 35,
    team: [{ id: "pr-roux" }, { id: "pr-benali" }, { id: "pr-nguyen" }], opposed: true,
    added: [["cat-podo", 4], ["cat-osteo", 5], ["cat-kine-renfo", 7]],
    states: "RNRRRRRRREA", report: true,
    extra: { raideurs: ["Hanches"], anti_inflammatoires: "Exceptionnellement" },
    goal: { title: "Marathon de Lille", detail: "Syndrome de la bandelette ilio-tibiale à surveiller", raceInWeeks: 14 },
    intake: {
      ordonnance: true, medecin_traitant: "Dr Roy", disponibilites: "En semaine, soir", course: "Marathon de Lille", temps_vise: "3h45",
      niveau: "Intermédiaire (1–3 ans)", km_semaine: 30, seances_semaine: 3, deja_marathon: false, programme: "Plan 20 semaines",
      antecedents: "RAS", cardio: false, traitements: "Aucun", blessures: "Bandelette ilio-tibiale genou gauche", douleur_actuelle: 2,
      zone_douleur: "Genou gauche (face externe)", chaussures: "Neutres", semelles: false, surface: "Mixte", poids: 72, taille: 176,
      regime: "Omnivore", troubles_digestifs: false, sommeil: 7, stress: 4, attentes: "Comprendre l'origine de la douleur",
    },
  },
];

const REPORTS: Record<string, { findings: Record<string, string>; recommendations: string; plan: string }> = {
  "pa-lea": {
    findings: {
      antecedents: "Périostite tibiale droite en 2025, résolue. Asthme d'effort contrôlé.",
      volume: "32 km/semaine sur 3 séances, montée prévue à 50 km.",
      objectif: "Premier marathon, objectif sous 4h : réaliste avec la montée en charge proposée.",
      douleurs: "Gêne tibiale droite légère (1/10) après les sorties longues.",
      appuis: "Attaque talon marquée, cadence 158 pas/min.",
      desequilibres: "Chute du bassin à droite, moyen fessier droit faible.",
    },
    recommendations: "Renforcement du moyen fessier, augmentation progressive de la cadence, bilan podologique conseillé.",
    plan: "Renforcement hanche 3 fois par semaine\nCadence cible 165 pas/min sur les footings\nVolume +10 % par semaine maximum\nBilan podologique et bilan diététique",
  },
  "pa-karim": {
    findings: {
      antecedents: "Tendinopathie d'Achille gauche en 2024.",
      volume: "55 km/semaine sur 5 séances.",
      objectif: "3h30 à Lyon : ambitieux mais cohérent avec son historique.",
      douleurs: "Raideur matinale du tendon d'Achille gauche.",
      appuis: "Médio-pied, bonne cadence (176 pas/min).",
      desequilibres: "Déficit de force excentrique du triceps sural gauche.",
    },
    recommendations: "Protocole excentrique quotidien, surveiller la raideur matinale, avis médical pour le volet cardiaque familial.",
    plan: "Excentriques mollet gauche tous les jours\nAlerte si raideur > 30 min le matin\nConsultation d'aptitude (antécédents familiaux)",
  },
  "pa-chloe": {
    findings: {
      antecedents: "Entorse de cheville droite en 2025, bien rééduquée.",
      volume: "35 km/semaine, 4 séances dont une en club.",
      objectif: "Gagner 10 minutes sur son marathon : réaliste en 25 semaines.",
      douleurs: "Gêne de cheville droite occasionnelle sur terrain irrégulier.",
      appuis: "Pronation droite marquée en fin de séance.",
      desequilibres: "Proprioception de la cheville droite à travailler.",
    },
    recommendations: "Travail proprioceptif, analyse de foulée sur tapis conseillée, avis diététique pour les troubles digestifs.",
    plan: "Proprioception 10 min, 3 fois par semaine\nAnalyse de foulée sur tapis\nBilan diététique (troubles digestifs à l'effort)",
  },
  "pa-marc": {
    findings: {
      antecedents: "HTA contrôlée, lombalgie chronique.",
      volume: "30 km/semaine sur 3 séances.",
      objectif: "Semi-marathon en 1h50 : atteignable.",
      douleurs: "Lombalgie 2/10 après les sorties longues.",
      appuis: "Foulée régulière, semelles adaptées.",
      desequilibres: "Gainage lombo-pelvien insuffisant.",
    },
    recommendations: "Gainage régulier ; suivi possible par son kiné habituel avec ce compte rendu.",
    plan: "Gainage 3 fois par semaine\nÉtirements des chaînes postérieures\nPartager ce bilan avec son kiné habituel",
  },
  "pa-ines": {
    findings: {
      antecedents: "Anémie ferriprive en 2023.", volume: "40 km/semaine, montée rapide.", objectif: "3h50 à Nice-Cannes.",
      douleurs: "Aucune au moment du bilan.", appuis: "Avant-pied, chaussures minimalistes.", desequilibres: "Charge osseuse élevée sur l'avant-pied.",
    },
    recommendations: "Transition progressive de chaussures, bilan diététique (apports énergétiques).",
    plan: "Chaussures plus amorties sur les sorties longues\nBilan diététique\nSurveiller toute douleur du pied",
  },
  "pa-antoine": {
    findings: {
      antecedents: "Bandelette ilio-tibiale gauche.", volume: "30 km/semaine.", objectif: "Marathon de Lille en 3h45.",
      douleurs: "Douleur externe du genou gauche à partir de 15 km.", appuis: "Valgus dynamique gauche.", desequilibres: "Moyen fessier gauche faible.",
    },
    recommendations: "Renforcement du moyen fessier, bilan podologique.",
    plan: "Renforcement hanche gauche\nLimiter les sorties > 15 km pendant 3 semaines\nBilan podologique",
  },
};

export function seed(db: DatabaseSync) {
  const now = Date.now();

  db.prepare("INSERT INTO coordinators (id, first_name, last_name, email) VALUES (?, ?, ?, ?)")
    .run(COORDINATOR.id, COORDINATOR.first, COORDINATOR.last, "lucie.fontaine@viasana.example");

  const insPract = db.prepare(
    "INSERT INTO practitioners (id, first_name, last_name, title, profession, specialty, location, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const p of PRACTITIONERS) {
    insPract.run(p.id, p.first, p.last, p.title, p.profession, p.specialty, p.location,
      `${p.first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${p.last.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}@partenaire.example`);
  }

  db.prepare("INSERT INTO pathways (id, name, description) VALUES (?, ?, ?)").run(PATHWAY.id, PATHWAY.name, PATHWAY.description);
  const insStep = db.prepare(
    "INSERT INTO pathway_steps (id, pathway_id, phase, position, title, description, profession, optional, week_offset) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  PATHWAY.steps.forEach((s, i) =>
    insStep.run(`${PATHWAY.id}-s${i + 1}`, PATHWAY.id, s.phase, i + 1, s.title, s.description, s.profession, s.optional, s.week),
  );
  const insCatalog = db.prepare("INSERT INTO step_catalog (id, title, description, profession) VALUES (?, ?, ?, ?)");
  for (const c of CATALOG) insCatalog.run(c.id, c.title, c.description, c.profession);

  const insPatient = db.prepare(
    "INSERT INTO patients (id, first_name, last_name, birth_date, sex, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insEnrollment = db.prepare(
    `INSERT INTO enrollments (id, patient_id, pathway_id, coordinator_id, offer, status, start_date, coordinated_until, goal_title, goal_date, goal_detail, sharing_opposed, consent_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insTeam = db.prepare(
    "INSERT INTO care_team (enrollment_id, practitioner_id, status, is_referent, proposed_at, decided_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const insAdded = db.prepare(
    `INSERT INTO enrollment_steps (id, enrollment_id, template_step_id, phase, position, planned_week, title, description, profession, optional, status, practitioner_id)
     SELECT ?, ?, NULL, 'parcours', ?, ?, title, description, profession, 0, 'a_venir',
            (SELECT pr.id FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
              WHERE ct.enrollment_id = ? AND ct.status = 'acceptee' AND pr.profession = step_catalog.profession ORDER BY ct.is_referent DESC LIMIT 1)
       FROM step_catalog WHERE id = ?`,
  );
  const updStep = db.prepare("UPDATE enrollment_steps SET status = ?, completed_at = ?, summary = ? WHERE id = ?");
  const insSession = db.prepare(
    "INSERT INTO sessions (id, enrollment_id, enrollment_step_id, practitioner_id, starts_at, duration_min, location, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insIntake = db.prepare("INSERT INTO intake_forms (enrollment_id, answers, submitted_at, updated_at) VALUES (?, ?, ?, ?)");
  const insReport = db.prepare(
    `INSERT INTO reports (id, enrollment_id, enrollment_step_id, author_id, title, findings, recommendations, action_plan, created_at, published_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insLog = db.prepare(
    "INSERT INTO access_logs (actor_type, actor_id, patient_id, action, allowed, at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const locationOf = (prId: string) => PRACTITIONERS.find((p) => p.id === prId)?.location ?? "";

  PATIENTS.forEach((p, index) => {
    const start = now - p.startDaysAgo * DAY;
    const enrollmentId = `en-${p.id.slice(3)}`;
    insPatient.run(
      p.id, p.first, p.last, p.birth, p.sex,
      `${p.first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${p.last.toLowerCase()}@exemple.fr`,
      `06 00 00 0${index} ${10 + index}`, at(start, -1),
    );
    insEnrollment.run(
      enrollmentId, p.id, PATHWAY.id, COORDINATOR.id, p.offer, p.status, dateOnly(start, 0),
      p.offer === "parcours" ? dateOnly(start, 14 + 182) : null,
      p.goal.title, p.goal.raceInWeeks !== undefined ? dateOnly(now, p.goal.raceInWeeks * 7 - 1) : null,
      p.goal.detail, p.opposed ? 1 : 0, p.opposed ? at(now, -10, 18, 12) : null,
    );
    p.team.forEach((m, i) =>
      insTeam.run(enrollmentId, m.id, m.status ?? "acceptee", i === 0 ? 1 : 0,
        at(start, m.status ? p.startDaysAgo - 1 : 0, 9), m.status ? null : at(start, 0, 18)),
    );

    instantiatePhase(db, enrollmentId, "bilan");
    if (p.offer === "parcours") instantiatePhase(db, enrollmentId, "parcours");
    (p.added ?? []).forEach(([catalogId, week], i) => insAdded.run(randomUUID(), enrollmentId, 20 + i, week, enrollmentId, catalogId));

    const steps = db
      .prepare("SELECT id, profession, planned_week, title, practitioner_id FROM enrollment_steps WHERE enrollment_id = ? ORDER BY planned_week, position")
      .all(enrollmentId) as { id: string; profession: string; planned_week: number; title: string; practitioner_id: string | null }[];

    let upcomingPlanned = false;
    const perWeek: Record<number, number> = {};
    steps.forEach((step, i) => {
      const code = p.states[i] ?? "A";
      const status = { R: "realisee", N: "non_retenue", E: "en_cours", A: "a_venir" }[code] ?? "a_venir";
      // Steps of the same week happen on consecutive days, in plan order.
      perWeek[step.planned_week] = (perWeek[step.planned_week] ?? -1) + 1;
      const day = step.planned_week * 7 + perWeek[step.planned_week];
      updStep.run(
        status, status === "realisee" ? at(start, step.profession === "patient" && step.planned_week === 0 ? 0 : day, 17) : null,
        status === "realisee" && !["patient", "coordinateur"].includes(step.profession) ? "Séance réalisée, compte rendu partagé avec l'équipe." : "",
        step.id,
      );
      if (!step.practitioner_id) return;
      if (status === "realisee") {
        insSession.run(randomUUID(), enrollmentId, step.id, step.practitioner_id, weekdayAt(start, day, 9 + (i % 8)), 30, locationOf(step.practitioner_id), "realisee");
      } else if ((status === "en_cours" || (status === "a_venir" && !upcomingPlanned)) && p.status === "actif" && !p.noUpcomingSession) {
        insSession.run(randomUUID(), enrollmentId, step.id, step.practitioner_id,
          weekdayAt(now, (status === "en_cours" ? 2 : 6) + (index % 4), 9 + (index % 8), 30), step.profession === "kine" && step.title.startsWith("Bilan de course") ? 30 : 45,
          locationOf(step.practitioner_id), "prevue");
        upcomingPlanned = true;
      }
    });

    if (p.intake) {
      const submitted = at(start, 0, 20, 15);
      const raceDate = p.goal.raceInWeeks ? dateOnly(now, p.goal.raceInWeeks * 7 - 1) : "";
      insIntake.run(enrollmentId, JSON.stringify(toAnswers(p.intake, raceDate, p.extra)), submitted, submitted);
    }

    const report = p.report ? REPORTS[p.id] : undefined;
    if (report) {
      const planStep = steps.find((s) => s.title === "Plan d'action remis");
      const author = p.team[0].id;
      insReport.run(
        `rp-${p.id.slice(3)}`, enrollmentId, planStep?.id ?? null, author, "Bilan de course", JSON.stringify(report.findings),
        report.recommendations, report.plan, at(start, 8, 16), at(start, 8, 16, 30),
      );
    }

    insLog.run("practitioner", p.team[0].id, p.id, "consultation_fiche", 1, at(now, -2, 9, 40));
    insLog.run("coordinator", COORDINATOR.id, p.id, "consultation_logistique", 1, at(now, -1, 11, 5));
  });

  // Marc shared his bilan with his usual physiotherapist (outside the care team).
  db.prepare(
    "INSERT INTO external_shares (id, enrollment_id, report_id, recipient_name, recipient_role, token, consent_at, last_access_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), "en-marc", "rp-marc", "Pauline Girard", "Kinésithérapeute habituelle", "demo-partage-marc", at(now, -20, 19), at(now, -19, 8, 30));
  insLog.run("external", "Pauline Girard", "pa-marc", "lecture_partage_externe", 1, at(now, -19, 8, 30));

  // A first reminder already sent to Hugo for his questionnaire.
  db.prepare("INSERT INTO relances (id, enrollment_id, coordinator_id, channel, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(randomUUID(), "en-hugo", COORDINATOR.id, "email", "Questionnaire en ligne non rempli", at(now, -1, 10, 0));

  // Follow-up notes
  const insNote = db.prepare("INSERT INTO notes (id, enrollment_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?)");
  const notes: [string, string, string, "equipe" | "privee" | "patient", number][] = [
    ["en-lea", "pr-petit", "Foulée sur tapis : attaque talon corrigée partiellement, cadence 162. Poursuivre le travail de cadence.", "equipe", -30],
    ["en-lea", "pr-petit", "Pensez à vos exercices de gainage après chaque sortie : 3 séries de 30 secondes suffisent.", "patient", -30],
    ["en-lea", "pr-nguyen", "Pas de semelles nécessaires. Chaussures à changer (450 km).", "equipe", -27],
    ["en-lea", "pr-lefevre", "Apports glucidiques insuffisants avant les sorties longues. Collation testée : banane + compote 1h avant.", "equipe", -26],
    ["en-lea", "pr-benali", "Restriction de mobilité cheville droite traitée, possiblement liée à l'ancienne périostite.", "equipe", -12],
    ["en-lea", "pr-benali", "À revoir si la gêne tibiale réapparaît avec la montée en volume.", "privee", -12],
    ["en-karim", "pr-roux", "Douleur Achille gauche réapparue après la sortie de 28 km. Volume réduit de 20 % cette semaine.", "equipe", -3],
    ["en-karim", "pr-morel", "Antécédents cardiaques familiaux : ECG d'effort normal, pas de contre-indication.", "equipe", -40],
    ["en-karim", "pr-lefevre", "Plan de ravitaillement : 1 gel tous les 7 km à partir du 10e.", "patient", -8],
    ["en-ines", "pr-morel", "Fracture de fatigue du 2e métatarsien gauche confirmée. Arrêt de la course 6 semaines.", "equipe", -6],
    ["en-ines", "pr-aubert", "Vit mal l'arrêt forcé. Séances de soutien maintenues pendant la pause.", "equipe", -4],
    ["en-antoine", "pr-roux", "Travail du moyen fessier priorisé, bonne progression.", "equipe", -8],
    ["en-antoine", "pr-benali", "Bassin en antéversion, traitement lombo-pelvien.", "equipe", -12],
  ];
  for (const [enrollmentId, author, body, visibility, days] of notes) {
    insNote.run(randomUUID(), enrollmentId, author, body, visibility, at(now, days, 17, 30));
  }

  // Weekly check-ins (patient self-reports, coordinated pathway only)
  const insCheckin = db.prepare(
    "INSERT INTO checkins (id, enrollment_id, author_type, author_id, date, weekly_km, pain, fatigue, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const checkins: [string, string, number[], number[], number[], string][] = [
    ["en-lea", "pa-lea", [34, 38, 41, 44], [1, 1, 2, 1], [4, 5, 5, 4], "Sortie longue de 22 km, bonnes sensations."],
    ["en-karim", "pa-karim", [52, 58, 60, 48], [1, 2, 4, 6], [4, 5, 6, 7], "Douleur au talon gauche le matin."],
    ["en-antoine", "pa-antoine", [24, 26, 30], [3, 2, 2], [3, 3, 3], ""],
  ];
  for (const [enrollmentId, patientId, km, pain, fatigue, lastComment] of checkins) {
    km.forEach((value, i) => {
      const weeksAgo = km.length - 1 - i;
      insCheckin.run(randomUUID(), enrollmentId, "patient", patientId, dateOnly(now, -weeksAgo * 7 - 1), value, pain[i], fatigue[i],
        i === km.length - 1 ? lastComment : "");
    });
  }
}
