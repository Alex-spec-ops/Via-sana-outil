// Relational model of the PrépaMarathon coordinated pathway.
//
// pathways / pathway_steps : the reusable template, in two phases ("bilan"
//                            then the optional "parcours" coordonné)
// step_catalog             : steps the coordinator can add once the bilan has
//                            identified the patient's needs
// enrollments              : one patient in one pathway (offer, status, consent)
// care_team                : the "équipe de soins" (CSP L1110-12). A partner is
//                            proposed by the coordinator and only gets access
//                            once the patient has accepted them.
// enrollment_steps         : the patient's own plan (template + added steps)
// sessions                 : appointments, optionally attached to a step
// reports                  : structured "bilan de course" reports / action plan
// external_shares          : a report shared, with consent, with a practitioner
//                            outside the care team (CSP L1110-4 III)
// notes, checkins          : follow-up information
// intake_forms             : the pre-bilan questionnaire (JSON answers)
// relances                 : the coordinator's follow-ups (logistics only)
// access_logs              : who read or changed which file, and when
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS coordinators (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS practitioners (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  profession TEXT NOT NULL CHECK (profession IN ('medecin','kine','osteo','podologue','dieteticien','sophrologue','chiropracteur','psychologue')),
  specialty TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
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
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS pathway_steps (
  id TEXT PRIMARY KEY,
  pathway_id TEXT NOT NULL REFERENCES pathways(id),
  phase TEXT NOT NULL CHECK (phase IN ('bilan','parcours')),
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  profession TEXT NOT NULL,
  optional INTEGER NOT NULL DEFAULT 0,
  week_offset INTEGER NOT NULL,
  UNIQUE (pathway_id, position)
);

CREATE TABLE IF NOT EXISTS step_catalog (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  profession TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  pathway_id TEXT NOT NULL REFERENCES pathways(id),
  coordinator_id TEXT NOT NULL REFERENCES coordinators(id),
  offer TEXT NOT NULL CHECK (offer IN ('bilan','parcours')),
  status TEXT NOT NULL CHECK (status IN ('actif','en_pause','termine')),
  start_date TEXT NOT NULL,
  coordinated_until TEXT,
  goal_title TEXT NOT NULL,
  goal_date TEXT,
  goal_detail TEXT NOT NULL DEFAULT '',
  sharing_opposed INTEGER NOT NULL DEFAULT 0,
  consent_updated_at TEXT
);

CREATE TABLE IF NOT EXISTS care_team (
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  status TEXT NOT NULL CHECK (status IN ('proposee','acceptee','refusee')),
  is_referent INTEGER NOT NULL DEFAULT 0,
  proposed_at TEXT NOT NULL,
  decided_at TEXT,
  PRIMARY KEY (enrollment_id, practitioner_id)
);

CREATE TABLE IF NOT EXISTS enrollment_steps (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  template_step_id TEXT REFERENCES pathway_steps(id),
  phase TEXT NOT NULL CHECK (phase IN ('bilan','parcours')),
  position INTEGER NOT NULL,
  planned_week INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  profession TEXT NOT NULL,
  optional INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('a_venir','en_cours','realisee','non_retenue')),
  practitioner_id TEXT REFERENCES practitioners(id),
  completed_at TEXT,
  summary TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  enrollment_step_id TEXT REFERENCES enrollment_steps(id),
  practitioner_id TEXT NOT NULL REFERENCES practitioners(id),
  starts_at TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 30,
  location TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('prevue','realisee','annulee'))
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  enrollment_step_id TEXT REFERENCES enrollment_steps(id),
  author_id TEXT NOT NULL REFERENCES practitioners(id),
  title TEXT NOT NULL,
  findings TEXT NOT NULL,
  recommendations TEXT NOT NULL DEFAULT '',
  action_plan TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS external_shares (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  report_id TEXT NOT NULL REFERENCES reports(id),
  recipient_name TEXT NOT NULL,
  recipient_role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  consent_at TEXT NOT NULL,
  revoked_at TEXT,
  last_access_at TEXT
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

CREATE TABLE IF NOT EXISTS relances (
  id TEXT PRIMARY KEY,
  enrollment_id TEXT NOT NULL REFERENCES enrollments(id),
  coordinator_id TEXT NOT NULL REFERENCES coordinators(id),
  channel TEXT NOT NULL CHECK (channel IN ('email','sms','telephone')),
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('patient','practitioner','coordinator','external')),
  actor_id TEXT NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  action TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  at TEXT NOT NULL
);

-- One login per person (patient, practitioner or coordinator). The password and
-- the email code are checked by Supabase Auth (auth_user_id); password_hash is
-- the former local scrypt hash, kept nullable for older rows.
CREATE TABLE IF NOT EXISTS credentials (
  email TEXT PRIMARY KEY,
  user_type TEXT NOT NULL CHECK (user_type IN ('patient','practitioner','coordinator')),
  user_id TEXT NOT NULL,
  password_hash TEXT,
  auth_user_id TEXT,
  demo INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  password_changed_at TEXT NOT NULL,
  UNIQUE (user_type, user_id)
);

-- Authentication journal: never the password, never an unknown identifier (§ 3.5).
CREATE TABLE IF NOT EXISTS auth_logs (
  id BIGSERIAL PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('connexion','echec','verrouillage','changement_mot_de_passe','code_envoye','code_refuse')),
  at TEXT NOT NULL
);

-- Second factor: after the password, a 6-digit single-use code (10 minutes,
-- 5 attempts). Only an HMAC of the code is stored.
CREATE TABLE IF NOT EXISTS login_challenges (
  id TEXT PRIMARY KEY,
  user_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  email TEXT NOT NULL,
  space TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  resends INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Demo stand-in for the email provider: the messages "sent" (all addresses
-- are fictional). Deleted as soon as the code is used.
CREATE TABLE IF NOT EXISTS demo_outbox (
  id BIGSERIAL PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_care_team_practitioner ON care_team(practitioner_id);
CREATE INDEX IF NOT EXISTS idx_steps_enrollment ON enrollment_steps(enrollment_id, planned_week, position);
CREATE INDEX IF NOT EXISTS idx_sessions_enrollment ON sessions(enrollment_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_notes_enrollment ON notes(enrollment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_access_logs_patient ON access_logs(patient_id, at);

-- Lock the tables against Supabase's public API (PostgREST / anon key): row
-- level security with no policy denies every row to the API roles, and their
-- privileges are revoked. The app reaches the database server side only, as the
-- table owner, and applies its own authorisation rules (queries.ts).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['coordinators','practitioners','patients','pathways','pathway_steps','step_catalog',
    'enrollments','care_team','enrollment_steps','sessions','reports','external_shares','notes','checkins',
    'intake_forms','relances','access_logs','credentials','auth_logs','login_challenges','demo_outbox','app_meta']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
  END IF;
END $$;
`;

/**
 * Additive, idempotent changes run at every start, so an older deployment
 * sharing the same database keeps working (no rebuild).
 */
export const MIGRATIONS = `
ALTER TABLE credentials ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS auth_user_id TEXT;
ALTER TABLE credentials ADD COLUMN IF NOT EXISTS demo INTEGER NOT NULL DEFAULT 0;
-- Seeded accounts have short ids (pa-lea, pr-petit…), sign-ups a UUID.
UPDATE credentials SET demo = 1 WHERE demo = 0 AND user_id NOT LIKE '%-%-%-%-%-%';
-- Passwords now live in Supabase Auth only: drop the former local hashes (data minimisation).
UPDATE credentials SET password_hash = NULL WHERE auth_user_id IS NOT NULL AND password_hash IS NOT NULL;
-- Sharing between practitioners is now an explicit consent given at sign-up: older demo rows get their sign-up date.
UPDATE enrollments SET consent_updated_at = start_date WHERE consent_updated_at IS NULL;
`;

/** Every table, children first — used to wipe the demo data. */
export const TABLES_CHILD_FIRST = [
  "demo_outbox", "login_challenges", "auth_logs", "credentials", "access_logs", "relances", "intake_forms", "checkins", "notes", "external_shares", "reports", "sessions",
  "enrollment_steps", "care_team", "enrollments", "step_catalog", "pathway_steps", "pathways", "patients",
  "practitioners", "coordinators",
];
