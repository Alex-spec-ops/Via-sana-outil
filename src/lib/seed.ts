import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { IntakeAnswers } from "./domain";

// 100 % fictional demo data. Dates are relative to the moment the database is
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

const PRACTITIONERS = [
  { id: "pr-morel", first: "Claire", last: "Morel", title: "Dr", profession: "medecin" },
  { id: "pr-petit", first: "Julien", last: "Petit", title: "", profession: "kine" },
  { id: "pr-roux", first: "Nadia", last: "Roux", title: "", profession: "kine" },
  { id: "pr-benali", first: "Sarah", last: "Benali", title: "", profession: "osteo" },
  { id: "pr-lefevre", first: "Thomas", last: "Lefèvre", title: "", profession: "dieteticien" },
] as const;

type StepDef = { title: string; description: string; profession: string; week: number };

const PATHWAYS: { id: string; name: string; description: string; weeks: number; steps: StepDef[] }[] = [
  {
    id: "pw-marathon",
    name: "Préparation Marathon",
    description:
      "Accompagnement pluridisciplinaire sur 18 semaines pour préparer un marathon en sécurité : aptitude médicale, prévention des blessures, nutrition et récupération.",
    weeks: 18,
    steps: [
      { title: "Formulaire préalable", description: "Le patient renseigne son objectif, ses antécédents et ses habitudes.", profession: "patient", week: 0 },
      { title: "Consultation d'aptitude", description: "Examen clinique, évaluation cardiovasculaire, certificat de non contre-indication.", profession: "medecin", week: 1 },
      { title: "Bilan kiné et analyse de foulée", description: "Tests de mobilité et de force, analyse vidéo de la foulée, programme de renforcement.", profession: "kine", week: 2 },
      { title: "Bilan diététique initial", description: "Évaluation des apports, plan alimentaire adapté à la charge d'entraînement.", profession: "dieteticien", week: 2 },
      { title: "Bilan ostéopathique", description: "Évaluation posturale et articulaire, traitement des restrictions de mobilité.", profession: "osteo", week: 3 },
      { title: "Point mi-parcours kiné", description: "Réévaluation, ajustement du renforcement selon la montée en charge.", profession: "kine", week: 8 },
      { title: "Stratégie nutritionnelle de course", description: "Plan de recharge glucidique, ravitaillements, tests à l'entraînement.", profession: "dieteticien", week: 11 },
      { title: "Séance ostéo pré-course", description: "Préparation tissulaire et articulaire avant l'affûtage.", profession: "osteo", week: 15 },
      { title: "Consultation de synthèse post-course", description: "Bilan de la course, récupération, suites à donner.", profession: "medecin", week: 18 },
    ],
  },
  {
    id: "pw-reprise",
    name: "Reprise de la course après blessure",
    description: "Parcours de 10 semaines pour reprendre la course à pied en sécurité après une blessure.",
    weeks: 10,
    steps: [
      { title: "Formulaire préalable", description: "Le patient décrit sa blessure, ses traitements et son objectif de reprise.", profession: "patient", week: 0 },
      { title: "Consultation médicale", description: "Diagnostic, imagerie si besoin, prescription de rééducation.", profession: "medecin", week: 1 },
      { title: "Rééducation – phase 1", description: "Contrôle de la douleur, mobilité, renforcement analytique.", profession: "kine", week: 1 },
      { title: "Séance ostéopathique", description: "Travail sur les compensations liées à la blessure.", profession: "osteo", week: 4 },
      { title: "Reprise progressive de la course", description: "Protocole course/marche, tests de reprise.", profession: "kine", week: 6 },
      { title: "Validation de la reprise", description: "Consultation de fin de parcours, autorisation de reprise complète.", profession: "medecin", week: 10 },
    ],
  },
];

type PatientDef = {
  id: string;
  first: string;
  last: string;
  birth: string;
  sex: "F" | "M";
  pathway: string;
  startWeeksAgo: number;
  done: number;
  status: "actif" | "en_pause" | "termine";
  team: string[];
  goal: { title: string; detail: string; raceInWeeks?: number };
  opposed?: boolean;
  intake: IntakeAnswers | null;
};

const PATIENTS: PatientDef[] = [
  {
    id: "pa-lea",
    first: "Léa",
    last: "Martin",
    birth: "1991-04-12",
    sex: "F",
    pathway: "pw-marathon",
    startWeeksAgo: 5,
    done: 5,
    status: "actif",
    team: ["pr-morel", "pr-petit", "pr-benali", "pr-lefevre"],
    goal: { title: "Finir le Marathon de Paris en moins de 4h", detail: "Premier marathon", raceInWeeks: 13 },
    intake: {
      course: "Marathon de Paris", temps_vise: "3h55", niveau: "Intermédiaire (1–3 ans)", km_semaine: 32,
      seances_semaine: 3, deja_marathon: false, antecedents: "Asthme d'effort léger", cardio: false,
      traitements: "Ventoline si besoin", allergies: "Aucune", blessures: "Périostite tibiale droite en 2025",
      douleur_actuelle: 1, zone_douleur: "Tibia droit (gêne légère)", poids: 61, taille: 168, regime: "Végétarien",
      troubles_digestifs: true, habitudes: "Peu de petit-déjeuner avant les sorties longues", sommeil: 7,
      activite_pro: "Sédentaire (bureau)", attentes: "Arriver au bout sans me blesser",
    },
  },
  {
    id: "pa-karim",
    first: "Karim",
    last: "Haddad",
    birth: "1985-09-03",
    sex: "M",
    pathway: "pw-marathon",
    startWeeksAgo: 9,
    done: 6,
    status: "actif",
    team: ["pr-morel", "pr-roux", "pr-benali", "pr-lefevre"],
    goal: { title: "Marathon de Lyon en 3h30", detail: "Troisième marathon, objectif chrono", raceInWeeks: 9 },
    intake: {
      course: "Marathon de Lyon", temps_vise: "3h30", niveau: "Confirmé (> 3 ans)", km_semaine: 55,
      seances_semaine: 5, deja_marathon: true, antecedents: "RAS", cardio: true,
      traitements: "Aucun", allergies: "Pénicilline", blessures: "Tendinopathie d'Achille gauche (2024)",
      douleur_actuelle: 2, zone_douleur: "Achille gauche", poids: 74, taille: 180, regime: "Omnivore",
      troubles_digestifs: false, habitudes: "Gels testés en course, hydratation irrégulière", sommeil: 6,
      activite_pro: "Commercial, beaucoup de route", attentes: "Optimiser la performance sans rechute",
    },
  },
  {
    id: "pa-sophie",
    first: "Sophie",
    last: "Garnier",
    birth: "1979-01-22",
    sex: "F",
    pathway: "pw-marathon",
    startWeeksAgo: 1,
    done: 1,
    status: "actif",
    team: ["pr-morel", "pr-petit", "pr-benali", "pr-lefevre"],
    goal: { title: "Courir le Marathon de Bordeaux", detail: "Objectif finisher", raceInWeeks: 17 },
    intake: {
      course: "Marathon de Bordeaux", temps_vise: "4h30", niveau: "Débutant (< 1 an)", km_semaine: 18,
      seances_semaine: 2, deja_marathon: false, antecedents: "Hypothyroïdie", cardio: false,
      traitements: "Lévothyroxine", allergies: "Aucune", blessures: "Aucune", douleur_actuelle: 0,
      zone_douleur: "", poids: 68, taille: 165, regime: "Omnivore", troubles_digestifs: false,
      habitudes: "Grignotage en fin de journée", sommeil: 7, activite_pro: "Infirmière (debout)",
      attentes: "Être bien encadrée pour un premier marathon",
    },
  },
  {
    id: "pa-hugo",
    first: "Hugo",
    last: "Lambert",
    birth: "1996-06-30",
    sex: "M",
    pathway: "pw-marathon",
    startWeeksAgo: 0,
    done: 0,
    status: "actif",
    team: ["pr-morel", "pr-petit", "pr-benali", "pr-lefevre"],
    goal: { title: "Premier marathon", detail: "Course à définir", raceInWeeks: 18 },
    intake: null,
  },
  {
    id: "pa-ines",
    first: "Inès",
    last: "Moreau",
    birth: "1988-11-08",
    sex: "F",
    pathway: "pw-marathon",
    startWeeksAgo: 7,
    done: 5,
    status: "en_pause",
    team: ["pr-morel", "pr-petit", "pr-benali", "pr-lefevre"],
    goal: { title: "Marathon de Nice-Cannes", detail: "Parcours suspendu : fracture de fatigue métatarsienne", raceInWeeks: 11 },
    intake: {
      course: "Marathon Nice-Cannes", temps_vise: "3h50", niveau: "Intermédiaire (1–3 ans)", km_semaine: 40,
      seances_semaine: 4, deja_marathon: false, antecedents: "Anémie ferriprive (2023)", cardio: false,
      traitements: "Supplémentation en fer", allergies: "Aucune", blessures: "Aucune", douleur_actuelle: 0,
      zone_douleur: "", poids: 55, taille: 170, regime: "Omnivore", troubles_digestifs: false,
      habitudes: "Apports caloriques probablement insuffisants", sommeil: 6, activite_pro: "Étudiante",
      attentes: "Progresser en confiance",
    },
  },
  {
    id: "pa-marc",
    first: "Marc",
    last: "Dubois",
    birth: "1972-02-14",
    sex: "M",
    pathway: "pw-marathon",
    startWeeksAgo: 20,
    done: 9,
    status: "termine",
    team: ["pr-morel", "pr-petit", "pr-benali", "pr-lefevre"],
    goal: { title: "Marathon de La Rochelle", detail: "Terminé en 3h58", raceInWeeks: -2 },
    intake: {
      course: "Marathon de La Rochelle", temps_vise: "4h00", niveau: "Confirmé (> 3 ans)", km_semaine: 45,
      seances_semaine: 4, deja_marathon: true, antecedents: "HTA contrôlée", cardio: true,
      traitements: "Amlodipine", allergies: "Aucune", blessures: "Lombalgie chronique", douleur_actuelle: 2,
      zone_douleur: "Lombaires", poids: 80, taille: 178, regime: "Omnivore", troubles_digestifs: false,
      habitudes: "", sommeil: 7, activite_pro: "Cadre, sédentaire", attentes: "Courir en sécurité après 50 ans",
    },
  },
  {
    id: "pa-chloe",
    first: "Chloé",
    last: "Bernard",
    birth: "1993-08-19",
    sex: "F",
    pathway: "pw-reprise",
    startWeeksAgo: 3,
    done: 3,
    status: "actif",
    team: ["pr-morel", "pr-roux", "pr-benali"],
    goal: { title: "Reprendre 3 sorties par semaine", detail: "Entorse de cheville droite" },
    intake: {
      course: "", temps_vise: "", niveau: "Intermédiaire (1–3 ans)", km_semaine: 0, seances_semaine: 0,
      deja_marathon: false, antecedents: "RAS", cardio: false, traitements: "Anti-inflammatoires (arrêtés)",
      allergies: "Aucune", blessures: "Entorse latérale cheville droite, grade 2", douleur_actuelle: 3,
      zone_douleur: "Cheville droite", sommeil: 8, activite_pro: "Professeure des écoles",
      attentes: "Reprendre sans récidive",
    },
  },
  {
    id: "pa-antoine",
    first: "Antoine",
    last: "Faure",
    birth: "1990-03-05",
    sex: "M",
    pathway: "pw-reprise",
    startWeeksAgo: 6,
    done: 4,
    status: "actif",
    team: ["pr-morel", "pr-roux", "pr-benali"],
    goal: { title: "Reprise après syndrome de l'essuie-glace", detail: "Objectif : 10 km sans douleur" },
    opposed: true,
    intake: {
      course: "10 km de Lille", temps_vise: "50 min", niveau: "Intermédiaire (1–3 ans)", km_semaine: 10,
      seances_semaine: 2, deja_marathon: false, antecedents: "RAS", cardio: false, traitements: "Aucun",
      allergies: "Aucune", blessures: "Syndrome de la bandelette ilio-tibiale genou gauche", douleur_actuelle: 2,
      zone_douleur: "Face externe du genou gauche", sommeil: 7, activite_pro: "Développeur",
      attentes: "Comprendre l'origine de la douleur",
    },
  },
];

export function seed(db: DatabaseSync) {
  const now = Date.now();

  const insPract = db.prepare(
    "INSERT INTO practitioners (id, first_name, last_name, title, profession, email) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const p of PRACTITIONERS) {
    insPract.run(p.id, p.first, p.last, p.title, p.profession, `${p.first.toLowerCase()}.${p.last.toLowerCase()}@viasana.example`);
  }

  const insPathway = db.prepare("INSERT INTO pathways (id, name, description, duration_weeks) VALUES (?, ?, ?, ?)");
  const insStep = db.prepare(
    "INSERT INTO pathway_steps (id, pathway_id, position, title, description, profession, week_offset) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const stepIds: Record<string, { id: string; def: StepDef }[]> = {};
  for (const pw of PATHWAYS) {
    insPathway.run(pw.id, pw.name, pw.description, pw.weeks);
    stepIds[pw.id] = pw.steps.map((def, i) => {
      const id = `${pw.id}-s${i + 1}`;
      insStep.run(id, pw.id, i + 1, def.title, def.description, def.profession, def.week);
      return { id, def };
    });
  }

  const insPatient = db.prepare(
    "INSERT INTO patients (id, first_name, last_name, birth_date, sex, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insEnrollment = db.prepare(
    `INSERT INTO enrollments (id, patient_id, pathway_id, status, start_date, goal_title, goal_date, goal_detail, sharing_opposed, consent_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insTeam = db.prepare("INSERT INTO care_team (enrollment_id, practitioner_id, is_referent) VALUES (?, ?, ?)");
  const insEStep = db.prepare(
    "INSERT INTO enrollment_steps (id, enrollment_id, step_id, status, practitioner_id, completed_at, summary) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insSession = db.prepare(
    "INSERT INTO sessions (id, enrollment_id, enrollment_step_id, practitioner_id, starts_at, duration_min, location, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const insIntake = db.prepare(
    "INSERT INTO intake_forms (enrollment_id, answers, submitted_at, updated_at) VALUES (?, ?, ?, ?)",
  );
  const insLog = db.prepare(
    "INSERT INTO access_logs (actor_type, actor_id, patient_id, action, allowed, at) VALUES (?, ?, ?, ?, ?, ?)",
  );

  PATIENTS.forEach((p, index) => {
    const start = now - p.startWeeksAgo * 7 * DAY;
    const enrollmentId = `en-${p.id.slice(3)}`;
    insPatient.run(
      p.id, p.first, p.last, p.birth, p.sex,
      `${p.first.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")}.${p.last.toLowerCase()}@exemple.fr`,
      `06 00 00 0${index} ${10 + index}`,
      at(start, -3),
    );
    insEnrollment.run(
      enrollmentId, p.id, p.pathway, p.status, dateOnly(start, 0), p.goal.title,
      p.goal.raceInWeeks !== undefined ? dateOnly(now, p.goal.raceInWeeks * 7 - 1) : null,
      p.goal.detail, p.opposed ? 1 : 0, p.opposed ? at(now, -10, 18, 12) : null,
    );
    p.team.forEach((pr, i) => insTeam.run(enrollmentId, pr, i === 0 ? 1 : 0));

    const practitionerFor = (profession: string) =>
      p.team.find((pr) => PRACTITIONERS.find((x) => x.id === pr)?.profession === profession) ?? null;

    stepIds[p.pathway].forEach(({ id: stepId, def }, i) => {
      const status = i < p.done ? "realisee" : i === p.done && p.status !== "termine" ? "en_cours" : "a_venir";
      const owner = def.profession === "patient" ? null : practitionerFor(def.profession);
      const eStepId = `${enrollmentId}-${i + 1}`;
      const stepDay = def.week * 7 + (i % 2);
      insEStep.run(
        eStepId, enrollmentId, stepId, status, owner,
        status === "realisee" ? at(start, def.profession === "patient" ? -1 : stepDay, 11) : null,
        status === "realisee" && def.profession !== "patient" ? "Séance réalisée, conclusions partagées avec l'équipe." : "",
      );
      if (!owner) return;
      if (status === "realisee") {
        insSession.run(randomUUID(), enrollmentId, eStepId, owner, weekdayAt(start, stepDay, 9 + (i % 7)), 45, "Centre Via Sana", "realisee");
      } else if (status === "en_cours" && p.status === "actif") {
        insSession.run(randomUUID(), enrollmentId, eStepId, owner, weekdayAt(now, 2 + (index % 5), 9 + (index % 8), 30), 45, "Centre Via Sana", "prevue");
      } else if (status === "a_venir" && i === p.done + 1 && p.status === "actif") {
        insSession.run(randomUUID(), enrollmentId, eStepId, owner, weekdayAt(now, 9 + (index % 6), 14 + (index % 4)), 45, "Centre Via Sana", "prevue");
      }
    });

    if (p.intake) {
      const submitted = at(start, -1, 20, 15);
      const answers = { ...p.intake, date_course: p.goal.raceInWeeks ? dateOnly(now, p.goal.raceInWeeks * 7 - 1) : "" };
      insIntake.run(enrollmentId, JSON.stringify(answers), submitted, submitted);
    }

    // A few historical reads so the access journal is not empty in the demo.
    p.team.slice(0, 2).forEach((pr, i) =>
      insLog.run("practitioner", pr, p.id, "consultation_fiche", 1, at(now, -(i + 1) * 2, 9 + i, 40)),
    );
  });

  // Follow-up notes
  const insNote = db.prepare(
    "INSERT INTO notes (id, enrollment_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?)",
  );
  const notes: [string, string, string, "equipe" | "privee" | "patient", number][] = [
    ["en-lea", "pr-morel", "Aptitude validée. Asthme d'effort bien contrôlé : Ventoline 15 min avant les séances de fractionné.", "equipe", -32],
    ["en-lea", "pr-petit", "Foulée : attaque talon marquée et chute du bassin à droite. Programme de renforcement moyen fessier 3x/semaine.", "equipe", -24],
    ["en-lea", "pr-petit", "Pensez à faire vos exercices de gainage après chaque sortie : 3 séries de 30 secondes suffisent.", "patient", -24],
    ["en-lea", "pr-lefevre", "Apports glucidiques insuffisants avant les sorties longues. Collation testée : banane + compote 1h avant.", "equipe", -22],
    ["en-lea", "pr-benali", "Restriction de mobilité cheville droite traitée, possiblement liée à l'ancienne périostite.", "equipe", -15],
    ["en-lea", "pr-benali", "À revoir si la gêne tibiale réapparaît avec la montée en volume.", "privee", -15],
    ["en-karim", "pr-roux", "Douleur Achille gauche réapparue après la sortie de 28 km. Réduction du volume de 20 % cette semaine, excentriques quotidiens.", "equipe", -3],
    ["en-karim", "pr-morel", "Antécédents cardiaques familiaux : ECG d'effort normal, pas de contre-indication.", "equipe", -60],
    ["en-karim", "pr-lefevre", "Plan de ravitaillement : 1 gel tous les 7 km à partir du 10e, à tester sur la prochaine sortie longue.", "patient", -12],
    ["en-ines", "pr-morel", "Fracture de fatigue du 2e métatarsien gauche confirmée à l'IRM. Arrêt de la course 6 semaines, parcours mis en pause.", "equipe", -6],
    ["en-ines", "pr-lefevre", "Suspicion de déficit énergétique relatif (RED-S) : bilan sanguin demandé au médecin.", "equipe", -5],
    ["en-sophie", "pr-morel", "Consultation d'aptitude prévue. Penser à vérifier le dernier bilan TSH.", "privee", -2],
    ["en-chloe", "pr-roux", "Proprioception en progrès, appui unipodal stable 45 s. Course/marche autorisée dès la semaine prochaine.", "equipe", -4],
    ["en-antoine", "pr-roux", "Étirements de la bandelette peu efficaces, travail du moyen fessier priorisé.", "equipe", -8],
    ["en-antoine", "pr-benali", "Bassin en antéversion, traitement lombo-pelvien.", "equipe", -12],
    ["en-marc", "pr-morel", "Course terminée en 3h58, récupération satisfaisante. Fin de parcours.", "patient", -1],
  ];
  for (const [enrollmentId, author, body, visibility, days] of notes) {
    insNote.run(randomUUID(), enrollmentId, author, body, visibility, at(now, days, 17, 30));
  }

  // Weekly check-ins (patient self-reports)
  const insCheckin = db.prepare(
    "INSERT INTO checkins (id, enrollment_id, author_type, author_id, date, weekly_km, pain, fatigue, comment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const checkins: [string, string, number[], number[], number[], string][] = [
    ["en-lea", "pa-lea", [30, 34, 36, 38], [1, 1, 2, 1], [3, 4, 5, 4], "Bonne semaine, sortie longue de 18 km."],
    ["en-karim", "pa-karim", [52, 58, 60, 48], [1, 2, 4, 6], [4, 5, 6, 7], "Douleur au talon gauche le matin."],
    ["en-sophie", "pa-sophie", [16, 18], [0, 0], [3, 3], "Je découvre, tout va bien."],
    ["en-chloe", "pa-chloe", [0, 3, 5], [4, 3, 3], [2, 2, 3], "Première course/marche sans douleur."],
    ["en-antoine", "pa-antoine", [6, 8, 10], [3, 2, 2], [3, 3, 3], ""],
  ];
  for (const [enrollmentId, patientId, km, pain, fatigue, lastComment] of checkins) {
    km.forEach((value, i) => {
      const weeksAgo = km.length - 1 - i;
      insCheckin.run(
        randomUUID(), enrollmentId, "patient", patientId, dateOnly(now, -weeksAgo * 7 - 1),
        value, pain[i], fatigue[i], i === km.length - 1 ? lastComment : "",
      );
    });
  }
}
