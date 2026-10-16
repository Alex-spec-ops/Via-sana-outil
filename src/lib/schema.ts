// Relational model of a coordinated care pathway.
//
// pathways / pathway_steps  : the reusable template ("Préparation Marathon")
// enrollments               : one patient following one pathway (goal, status, consent)
// care_team                 : the "équipe de soins" (CSP L1110-12) — the only
//                             practitioners allowed to open the patient's file
// enrollment_steps          : progress of each template step for this patient
// sessions                  : appointments, optionally attached to a step
// notes                     : follow-up notes with an explicit visibility
// checkins                  : simple self-reported or practitioner-entered metrics
// intake_forms              : the pre-pathway questionnaire (JSON answers)
// access_logs               : who read or changed which file, and when
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  profession TEXT NOT NULL CHECK (profession IN ('medecin','kine','osteo','dieteticien')),
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,
  sex TEXT NOT NULL CHECK (sex IN ('F','M','X')),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pathways (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_weeks INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pathway_steps (
  id TEXT PRIMARY KEY,
  pathway_id TEXT NOT NULL REFERENCES pathways(id),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  profession TEXT NOT NULL CHECK (profession IN ('patient','medecin','kine','osteo','dieteticien')),
  week_offset INTEGER NOT NULL,
  UNIQUE (pathway_id, position)
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  pathway_id TEXT NOT NULL REFERENCES pathways(id),
  status TEXT NOT NULL CHECK (status IN ('actif','en_pause','termine')),
  start_date TEXT NOT NULL,
  goal_title TEXT NOT NULL,
  goal_date TEXT,
  goal_detail TEXT NOT NULL DEFAULT '',
  sharing_opposed INTEGER NOT NULL DEFAULT 0,
  consent_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS care_team (
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  is_referent INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (enrollment_id, practitioner_id)
);

CREATE TABLE IF NOT EXISTS enrollment_steps (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  step_id TEXT NOT NULL REFERENCES pathway_steps(id),
  status TEXT NOT NULL CHECK (status IN ('a_venir','en_cours','realisee')),
  practitioner_id TEXT REFERENCES practitioners(id),
  completed_at TEXT,
  summary TEXT NOT NULL DEFAULT '',
  UNIQUE (enrollment_id, step_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  enrollment_step_id TEXT REFERENCES enrollment_steps(id),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  starts_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 45,
  location TEXT NOT NULL DEFAULT 'Centre Via Sana',
  status TEXT NOT NULL CHECK (status IN ('prevue','realisee','annulee'))
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  author_id TEXT NOT NULL REFERENCES practitioners(id),
  body TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('equipe','privee','patient')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS checkins (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  author_type TEXT NOT NULL CHECK (author_type IN ('patient','practitioner')),
  author_id TEXT NOT NULL,
  date TEXT NOT NULL,
  weekly_km REAL,
  pain INTEGER CHECK (pain BETWEEN 0 AND 10),
  fatigue INTEGER CHECK (fatigue BETWEEN 0 AND 10),
  comment TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS intake_forms (
  enrollment_id TEXT PRIMARY KEY REFERENCES enrollments(id),
  answers TEXT NOT NULL,
  submitted_at TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('patient','practitioner')),
  actor_id TEXT NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  action TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_team_practitioner ON care_team(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_sessions_enrollment ON sessions(enrollment_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_notes_enrollment ON notes(enrollment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_patient ON access_logs(patient_id, at);
`;
