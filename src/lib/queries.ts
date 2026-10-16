import "server-only";
import { all, get, run } from "./db";
import type { PractitionerUser } from "./auth";
import {
  visibleSectionsFor,
  type EnrollmentStatus,
  type IntakeAnswers,
  type IntakeSection,
  type NoteVisibility,
  type Profession,
  type SessionStatus,
  type StepOwner,
  type StepStatus,
} from "./domain";

// Every read of a patient file goes through this module. Authorisation is
// enforced here, server side, from the care_team table — never in the UI only.

export type ActorType = "patient" | "practitioner";

export function logAccess(actorType: ActorType, actorId: string, patientId: string, action: string, allowed = true) {
  run(
    "INSERT INTO access_logs (actor_type, actor_id, patient_id, action, allowed, at) VALUES (?, ?, ?, ?, ?, ?)",
    actorType, actorId, patientId, action, allowed ? 1 : 0, new Date().toISOString(),
  );
}

/** Returns true only if the practitioner belongs to the enrollment's care team (CSP L1110-12). */
export function isInCareTeam(practitionerId: string, enrollmentId: string) {
  return Boolean(
    get("SELECT 1 AS ok FROM care_team WHERE practitioner_id = ? AND enrollment_id = ?", practitionerId, enrollmentId),
  );
}

// ---------------------------------------------------------------- Practitioner

export type PatientListRow = {
  enrollment_id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  pathway_id: string;
  pathway_name: string;
  status: EnrollmentStatus;
  goal_title: string;
  goal_date: string | null;
  current_step_title: string | null;
  current_step_position: number | null;
  current_step_profession: StepOwner | null;
  done_steps: number;
  total_steps: number;
  next_session_at: string | null;
  last_pain: number | null;
  intake_submitted: string | null;
  is_referent: number;
};

export type PatientFilters = { pathway?: string; status?: string; step?: string; q?: string; alert?: string };

export function listPatientsForPractitioner(practitionerId: string, filters: PatientFilters = {}) {
  const rows = all<PatientListRow>(
    `SELECT e.id AS enrollment_id, p.id AS patient_id, p.first_name, p.last_name, p.birth_date,
            pw.id AS pathway_id, pw.name AS pathway_name, e.status, e.goal_title, e.goal_date, ct.is_referent,
            cur.title AS current_step_title, cur.position AS current_step_position, cur.profession AS current_step_profession,
            (SELECT COUNT(*) FROM enrollment_steps es WHERE es.enrollment_id = e.id AND es.status = 'realisee') AS done_steps,
            (SELECT COUNT(*) FROM pathway_steps ps WHERE ps.pathway_id = pw.id) AS total_steps,
            (SELECT MIN(s.starts_at) FROM sessions s WHERE s.enrollment_id = e.id AND s.status = 'prevue' AND s.starts_at >= ?) AS next_session_at,
            (SELECT c.pain FROM checkins c WHERE c.enrollment_id = e.id ORDER BY c.date DESC LIMIT 1) AS last_pain,
            (SELECT f.submitted_at FROM intake_forms f WHERE f.enrollment_id = e.id) AS intake_submitted
       FROM care_team ct
       JOIN enrollments e ON e.id = ct.enrollment_id
       JOIN patients p ON p.id = e.patient_id
       JOIN pathways pw ON pw.id = e.pathway_id
       LEFT JOIN (
         SELECT es.enrollment_id, ps.title, ps.position, ps.profession
           FROM enrollment_steps es JOIN pathway_steps ps ON ps.id = es.step_id
          WHERE es.status = 'en_cours'
       ) cur ON cur.enrollment_id = e.id
      WHERE ct.practitioner_id = ?
      ORDER BY CASE e.status WHEN 'actif' THEN 0 WHEN 'en_pause' THEN 1 ELSE 2 END, p.last_name`,
    new Date().toISOString(),
    practitionerId,
  );

  const q = filters.q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.pathway && r.pathway_id !== filters.pathway) return false;
    if (filters.status && r.status !== filters.status) return false;
    // step filter value is "<pathwayId>:<position>" since positions repeat across pathways
    if (filters.step && `${r.pathway_id}:${r.current_step_position ?? ""}` !== filters.step) return false;
    if (filters.alert === "1" && patientAlerts(r).length === 0) return false;
    if (q && !`${r.first_name} ${r.last_name} ${r.goal_title}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export function patientAlerts(r: Pick<PatientListRow, "status" | "last_pain" | "intake_submitted">) {
  const alerts: string[] = [];
  if (r.status === "termine") return alerts;
  if (!r.intake_submitted) alerts.push("Formulaire préalable non rempli");
  if (r.last_pain !== null && r.last_pain >= 5) alerts.push(`Douleur déclarée ${r.last_pain}/10`);
  if (r.status === "en_pause") alerts.push("Parcours en pause");
  return alerts;
}

export function listPathways() {
  return all<{ id: string; name: string; duration_weeks: number }>("SELECT id, name, duration_weeks FROM pathways ORDER BY name");
}

export function listPathwaySteps(pathwayId?: string) {
  return all<{ pathway_id: string; position: number; title: string }>(
    `SELECT pathway_id, position, title FROM pathway_steps ${pathwayId ? "WHERE pathway_id = ?" : ""} ORDER BY pathway_id, position`,
    ...(pathwayId ? [pathwayId] : []),
  );
}

export type UpcomingSession = {
  id: string;
  starts_at: string;
  duration_min: number;
  location: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  step_title: string | null;
};

export function upcomingSessionsForPractitioner(practitionerId: string, limit = 6) {
  return all<UpcomingSession>(
    `SELECT s.id, s.starts_at, s.duration_min, s.location, p.id AS patient_id, p.first_name, p.last_name, ps.title AS step_title
       FROM sessions s
       JOIN enrollments e ON e.id = s.enrollment_id
       JOIN patients p ON p.id = e.patient_id
       LEFT JOIN enrollment_steps es ON es.id = s.enrollment_step_id
       LEFT JOIN pathway_steps ps ON ps.id = es.step_id
      WHERE s.practitioner_id = ? AND s.status = 'prevue' AND s.starts_at >= ?
      ORDER BY s.starts_at LIMIT ?`,
    practitionerId, new Date().toISOString(), limit,
  );
}

// ------------------------------------------------------------- Shared shapes

export type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  profession: Profession;
  is_referent: number;
};

export type TimelineStep = {
  id: string;
  position: number;
  title: string;
  description: string;
  profession: StepOwner;
  week_offset: number;
  status: StepStatus;
  completed_at: string | null;
  summary: string;
  practitioner_id: string | null;
  practitioner_name: string | null;
};

export type SessionRow = {
  id: string;
  starts_at: string;
  duration_min: number;
  location: string;
  status: SessionStatus;
  practitioner_id: string;
  practitioner_name: string;
  profession: Profession;
  step_title: string | null;
  enrollment_step_id: string | null;
};

export type NoteRow = {
  id: string;
  body: string;
  visibility: NoteVisibility;
  created_at: string;
  author_id: string;
  author_name: string;
  profession: Profession;
};

export type CheckinRow = {
  id: string;
  date: string;
  weekly_km: number | null;
  pain: number | null;
  fatigue: number | null;
  comment: string;
  author_type: ActorType;
};

export type AccessLogRow = {
  id: number;
  actor_type: ActorType;
  actor_name: string;
  profession: Profession | null;
  action: string;
  allowed: number;
  at: string;
};

export type EnrollmentRow = {
  id: string;
  patient_id: string;
  pathway_id: string;
  pathway_name: string;
  pathway_description: string;
  duration_weeks: number;
  status: EnrollmentStatus;
  start_date: string;
  goal_title: string;
  goal_date: string | null;
  goal_detail: string;
  sharing_opposed: number;
  consent_updated_at: string | null;
};

export type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: "F" | "M" | "X";
  email: string;
  phone: string;
};

const ENROLLMENT_SELECT = `
  SELECT e.*, pw.name AS pathway_name, pw.description AS pathway_description, pw.duration_weeks
    FROM enrollments e JOIN pathways pw ON pw.id = e.pathway_id`;

function getTeam(enrollmentId: string) {
  return all<TeamMember>(
    `SELECT pr.id, pr.first_name, pr.last_name, pr.title, pr.profession, ct.is_referent
       FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ?
      ORDER BY ct.is_referent DESC, CASE pr.profession WHEN 'medecin' THEN 0 WHEN 'kine' THEN 1 WHEN 'osteo' THEN 2 ELSE 3 END`,
    enrollmentId,
  );
}

function getTimeline(enrollmentId: string) {
  return all<TimelineStep>(
    `SELECT es.id, ps.position, ps.title, ps.description, ps.profession, ps.week_offset, es.status, es.completed_at, es.summary,
            es.practitioner_id, CASE WHEN pr.id IS NULL THEN NULL ELSE TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) END AS practitioner_name
       FROM enrollment_steps es
       JOIN pathway_steps ps ON ps.id = es.step_id
       LEFT JOIN practitioners pr ON pr.id = es.practitioner_id
      WHERE es.enrollment_id = ?
      ORDER BY ps.position`,
    enrollmentId,
  );
}

function getSessions(enrollmentId: string) {
  return all<SessionRow>(
    `SELECT s.id, s.starts_at, s.duration_min, s.location, s.status, s.practitioner_id, s.enrollment_step_id,
            TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS practitioner_name, pr.profession, ps.title AS step_title
       FROM sessions s
       JOIN practitioners pr ON pr.id = s.practitioner_id
       LEFT JOIN enrollment_steps es ON es.id = s.enrollment_step_id
       LEFT JOIN pathway_steps ps ON ps.id = es.step_id
      WHERE s.enrollment_id = ?
      ORDER BY s.starts_at`,
    enrollmentId,
  );
}

function getCheckins(enrollmentId: string) {
  return all<CheckinRow>(
    "SELECT id, date, weekly_km, pain, fatigue, comment, author_type FROM checkins WHERE enrollment_id = ? ORDER BY date DESC",
    enrollmentId,
  );
}

function getIntake(enrollmentId: string) {
  const row = get<{ answers: string; submitted_at: string | null; updated_at: string }>(
    "SELECT answers, submitted_at, updated_at FROM intake_forms WHERE enrollment_id = ?",
    enrollmentId,
  );
  if (!row) return null;
  return { answers: JSON.parse(row.answers) as IntakeAnswers, submitted_at: row.submitted_at, updated_at: row.updated_at };
}

function getAccessLogs(patientId: string, limit = 30) {
  return all<AccessLogRow>(
    `SELECT l.id, l.actor_type, l.action, l.allowed, l.at, pr.profession,
            CASE WHEN l.actor_type = 'patient' THEN 'Le patient'
                 ELSE TRIM(COALESCE(pr.title, '') || ' ' || COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')) END AS actor_name
       FROM access_logs l
       LEFT JOIN practitioners pr ON l.actor_type = 'practitioner' AND pr.id = l.actor_id
      WHERE l.patient_id = ?
      ORDER BY l.at DESC LIMIT ?`,
    patientId, limit,
  );
}

// ------------------------------------------------------- Practitioner: file

export type PractitionerPatientFile = {
  patient: PatientRow;
  enrollment: EnrollmentRow;
  team: TeamMember[];
  timeline: TimelineStep[];
  sessions: SessionRow[];
  notes: NoteRow[];
  hiddenNotesCount: number;
  checkins: CheckinRow[];
  intake: { answers: IntakeAnswers; submitted_at: string | null; updated_at: string } | null;
  intakeSections: IntakeSection[];
  hiddenIntakeSections: IntakeSection[];
  accessLogs: AccessLogRow[];
};

/**
 * Loads a patient file for a practitioner, or returns null (and logs a refused
 * access) when the practitioner is not part of that patient's care team.
 */
export function getPatientFileForPractitioner(
  practitioner: PractitionerUser,
  patientId: string,
): PractitionerPatientFile | null {
  const enrollment = get<EnrollmentRow>(
    `${ENROLLMENT_SELECT}
      JOIN care_team ct ON ct.enrollment_id = e.id AND ct.practitioner_id = ?
     WHERE e.patient_id = ?
     ORDER BY e.start_date DESC LIMIT 1`,
    practitioner.id, patientId,
  );
  const patient = get<PatientRow>(
    "SELECT id, first_name, last_name, birth_date, sex, email, phone FROM patients WHERE id = ?",
    patientId,
  );
  if (!patient) return null;
  if (!enrollment) {
    logAccess("practitioner", practitioner.id, patientId, "consultation_fiche", false);
    return null;
  }
  logAccess("practitioner", practitioner.id, patientId, "consultation_fiche");

  // With the patient's opposition (CSP L1110-4 IV), practitioners keep only what
  // they produced themselves; nothing written by colleagues is shared.
  const opposed = enrollment.sharing_opposed === 1;
  const allNotes = all<NoteRow>(
    `SELECT n.id, n.body, n.visibility, n.created_at, n.author_id, pr.profession,
            TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS author_name
       FROM notes n JOIN practitioners pr ON pr.id = n.author_id
      WHERE n.enrollment_id = ?
      ORDER BY n.created_at DESC`,
    enrollment.id,
  );
  const notes = allNotes.filter((n) => {
    if (n.author_id === practitioner.id) return true;
    if (opposed) return false;
    return n.visibility !== "privee";
  });

  const intakeSections = visibleSectionsFor(practitioner.profession);
  return {
    patient,
    enrollment,
    team: getTeam(enrollment.id),
    timeline: getTimeline(enrollment.id),
    sessions: getSessions(enrollment.id),
    notes,
    hiddenNotesCount: opposed ? allNotes.filter((n) => n.author_id !== practitioner.id && n.visibility !== "privee").length : 0,
    checkins: getCheckins(enrollment.id),
    intake: getIntake(enrollment.id),
    intakeSections,
    hiddenIntakeSections: visibleSectionsFor("patient").filter((s) => !intakeSections.includes(s)),
    accessLogs: getAccessLogs(patientId, 15),
  };
}

// ------------------------------------------------------------ Patient space

export type PatientSpace = {
  patient: PatientRow;
  enrollment: EnrollmentRow;
  team: TeamMember[];
  timeline: TimelineStep[];
  sessions: SessionRow[];
  notes: NoteRow[];
  checkins: CheckinRow[];
  intake: { answers: IntakeAnswers; submitted_at: string | null; updated_at: string } | null;
  accessLogs: AccessLogRow[];
};

export function getPatientSpace(patientId: string): PatientSpace | null {
  const patient = get<PatientRow>(
    "SELECT id, first_name, last_name, birth_date, sex, email, phone FROM patients WHERE id = ?",
    patientId,
  );
  const enrollment = get<EnrollmentRow>(
    `${ENROLLMENT_SELECT} WHERE e.patient_id = ? ORDER BY CASE e.status WHEN 'termine' THEN 1 ELSE 0 END, e.start_date DESC LIMIT 1`,
    patientId,
  );
  if (!patient || !enrollment) return null;
  return {
    patient,
    enrollment,
    team: getTeam(enrollment.id),
    timeline: getTimeline(enrollment.id),
    sessions: getSessions(enrollment.id),
    // The patient sees the notes written for them, never internal team notes.
    notes: all<NoteRow>(
      `SELECT n.id, n.body, n.visibility, n.created_at, n.author_id, pr.profession,
              TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS author_name
         FROM notes n JOIN practitioners pr ON pr.id = n.author_id
        WHERE n.enrollment_id = ? AND n.visibility = 'patient'
        ORDER BY n.created_at DESC`,
      enrollment.id,
    ),
    checkins: getCheckins(enrollment.id),
    intake: getIntake(enrollment.id),
    accessLogs: getAccessLogs(patientId),
  };
}

// ---------------------------------------------------------------- Demo login

export function listPersonas() {
  const practitioners = all<PractitionerUser & { patient_count: number }>(
    `SELECT pr.*, (SELECT COUNT(*) FROM care_team ct WHERE ct.practitioner_id = pr.id) AS patient_count
       FROM practitioners pr ORDER BY CASE pr.profession WHEN 'medecin' THEN 0 WHEN 'kine' THEN 1 WHEN 'osteo' THEN 2 ELSE 3 END, pr.last_name`,
  );
  const patients = all<{ id: string; first_name: string; last_name: string; pathway_name: string; status: EnrollmentStatus; goal_title: string }>(
    `SELECT p.id, p.first_name, p.last_name, pw.name AS pathway_name, e.status, e.goal_title
       FROM patients p JOIN enrollments e ON e.patient_id = p.id JOIN pathways pw ON pw.id = e.pathway_id
      ORDER BY CASE e.status WHEN 'actif' THEN 0 WHEN 'en_pause' THEN 1 ELSE 2 END, p.last_name`,
  );
  return { practitioners, patients };
}
