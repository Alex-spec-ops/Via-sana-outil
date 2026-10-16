import "server-only";
import { all, get, run } from "./db";
import type { CoordinatorUser, PractitionerUser } from "./auth";
import {
  BILAN_DIMENSIONS,
  visibleSectionsFor,
  type EnrollmentStatus,
  type IntakeAnswers,
  type IntakeSection,
  type NoteVisibility,
  type Offer,
  type Phase,
  type Profession,
  type SessionStatus,
  type StepOwner,
  type StepStatus,
  type TeamStatus,
} from "./domain";

// Every read of a patient file goes through this module. Authorisation is
// enforced here, server side — never in the UI only:
// - a practitioner reads a file only once the patient has accepted them in the
//   care team (CSP L1110-12), and only the intake sections their profession needs;
// - the coordinator (Via Sana staff, not a health professional) reads logistics
//   only: steps, appointments, team, organisation answers — no clinical content;
// - a report shared outside the team is readable through its link until revoked.

export type ActorType = "patient" | "practitioner" | "coordinator" | "external";

export async function logAccess(actorType: ActorType, actorId: string, patientId: string, action: string, allowed = true) {
  await run(
    "INSERT INTO access_logs (actor_type, actor_id, patient_id, action, allowed, at) VALUES (?, ?, ?, ?, ?, ?)",
    actorType, actorId, patientId, action, allowed ? 1 : 0, new Date().toISOString(),
  );
}

/** True only if the patient has accepted this practitioner in their care team. */
export async function isInCareTeam(practitionerId: string, enrollmentId: string) {
  return Boolean(
    get("SELECT 1 AS ok FROM care_team WHERE practitioner_id = ? AND enrollment_id = ? AND status = 'acceptee'", practitionerId, enrollmentId),
  );
}

// ------------------------------------------------------------- Shared shapes

export type PatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: "F" | "M" | "X";
  email: string;
  phone: string;
};

export type EnrollmentRow = {
  id: string;
  patient_id: string;
  pathway_id: string;
  pathway_name: string;
  coordinator_id: string;
  coordinator_name: string;
  offer: Offer;
  status: EnrollmentStatus;
  start_date: string;
  coordinated_until: string | null;
  goal_title: string;
  goal_date: string | null;
  goal_detail: string;
  sharing_opposed: number;
  consent_updated_at: string | null;
};

export type TeamMember = {
  id: string;
  first_name: string;
  last_name: string;
  title: string;
  profession: Profession;
  specialty: string;
  location: string;
  status: TeamStatus;
  is_referent: number;
  proposed_at: string;
  decided_at: string | null;
};

export type TimelineStep = {
  id: string;
  phase: Phase;
  position: number;
  planned_week: number;
  title: string;
  description: string;
  profession: StepOwner;
  optional: number;
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
  author_type: "patient" | "practitioner";
};

export type ReportRow = {
  id: string;
  enrollment_id: string;
  enrollment_step_id: string | null;
  author_id: string;
  author_name: string;
  author_profession: Profession;
  author_specialty: string;
  title: string;
  findings: Record<string, string>;
  recommendations: string;
  action_plan: string;
  created_at: string;
  published_at: string | null;
};

export type ShareRow = {
  id: string;
  report_id: string;
  recipient_name: string;
  recipient_role: string;
  token: string;
  consent_at: string;
  revoked_at: string | null;
  last_access_at: string | null;
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

export type IntakeRow = { answers: IntakeAnswers; submitted_at: string | null; updated_at: string };

const ENROLLMENT_SELECT = `
  SELECT e.*, pw.name AS pathway_name, co.first_name || ' ' || co.last_name AS coordinator_name
    FROM enrollments e
    JOIN pathways pw ON pw.id = e.pathway_id
    JOIN coordinators co ON co.id = e.coordinator_id`;

const PATIENT_SELECT = "SELECT id, first_name, last_name, birth_date, sex, email, phone FROM patients WHERE id = ?";

async function getTeam(enrollmentId: string) {
  return await all<TeamMember>(
    `SELECT pr.id, pr.first_name, pr.last_name, pr.title, pr.profession, pr.specialty, pr.location,
            ct.status, ct.is_referent, ct.proposed_at, ct.decided_at
       FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ?
      ORDER BY CASE ct.status WHEN 'acceptee' THEN 0 WHEN 'proposee' THEN 1 ELSE 2 END, ct.is_referent DESC, pr.last_name`,
    enrollmentId,
  );
}

async function getTimeline(enrollmentId: string) {
  return await all<TimelineStep>(
    `SELECT es.id, es.phase, es.position, es.planned_week, es.title, es.description, es.profession, es.optional, es.status,
            es.completed_at, es.summary, es.practitioner_id,
            CASE WHEN pr.id IS NULL THEN NULL ELSE TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) END AS practitioner_name
       FROM enrollment_steps es
       LEFT JOIN practitioners pr ON pr.id = es.practitioner_id
      WHERE es.enrollment_id = ?
      ORDER BY es.planned_week, es.position`,
    enrollmentId,
  );
}

async function getSessions(enrollmentId: string) {
  return await all<SessionRow>(
    `SELECT s.id, s.starts_at, s.duration_min, s.location, s.status, s.practitioner_id, s.enrollment_step_id,
            TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS practitioner_name, pr.profession, es.title AS step_title
       FROM sessions s
       JOIN practitioners pr ON pr.id = s.practitioner_id
       LEFT JOIN enrollment_steps es ON es.id = s.enrollment_step_id
      WHERE s.enrollment_id = ?
      ORDER BY s.starts_at`,
    enrollmentId,
  );
}

async function getCheckins(enrollmentId: string) {
  return await all<CheckinRow>(
    "SELECT id, date, weekly_km, pain, fatigue, comment, author_type FROM checkins WHERE enrollment_id = ? ORDER BY date DESC",
    enrollmentId,
  );
}

async function getIntake(enrollmentId: string): Promise<IntakeRow | null> {
  const row = await get<{ answers: string; submitted_at: string | null; updated_at: string }>(
    "SELECT answers, submitted_at, updated_at FROM intake_forms WHERE enrollment_id = ?",
    enrollmentId,
  );
  if (!row) return null;
  return { answers: JSON.parse(row.answers) as IntakeAnswers, submitted_at: row.submitted_at, updated_at: row.updated_at };
}

const REPORT_SELECT = `
  SELECT r.*, TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS author_name,
         pr.profession AS author_profession, pr.specialty AS author_specialty
    FROM reports r JOIN practitioners pr ON pr.id = r.author_id`;

function parseReport(row: Omit<ReportRow, "findings"> & { findings: string }): ReportRow {
  return { ...row, findings: JSON.parse(row.findings) as Record<string, string> };
}

async function getReports(enrollmentId: string): Promise<ReportRow[]> {
  const rows = await all<Omit<ReportRow, "findings"> & { findings: string }>(
    `${REPORT_SELECT} WHERE r.enrollment_id = ? ORDER BY r.created_at DESC`,
    enrollmentId,
  );
  return rows.map(parseReport);
}

async function getAccessLogs(patientId: string, limit = 30) {
  return await all<AccessLogRow>(
    `SELECT l.id, l.actor_type, l.action, l.allowed, l.at, pr.profession,
            CASE l.actor_type
              WHEN 'patient' THEN 'Le patient'
              WHEN 'coordinator' THEN COALESCE(co.first_name || ' ' || co.last_name || ' (coordination)', 'Coordination')
              WHEN 'external' THEN l.actor_id || ' (hors équipe)'
              ELSE TRIM(COALESCE(pr.title, '') || ' ' || COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')) END AS actor_name
       FROM access_logs l
       LEFT JOIN practitioners pr ON l.actor_type = 'practitioner' AND pr.id = l.actor_id
       LEFT JOIN coordinators co ON l.actor_type = 'coordinator' AND co.id = l.actor_id
      WHERE l.patient_id = ?
      ORDER BY l.at DESC LIMIT ?`,
    patientId, limit,
  );
}

// ---------------------------------------------------------------- Lists

export type ListRow = {
  enrollment_id: string;
  patient_id: string;
  first_name: string;
  last_name: string;
  birth_date: string;
  offer: Offer;
  status: EnrollmentStatus;
  goal_title: string;
  goal_date: string | null;
  coordinated_until: string | null;
  start_date: string;
  current_step_id: string | null;
  current_step_title: string | null;
  current_step_profession: StepOwner | null;
  current_step_has_session: number;
  done_steps: number;
  total_steps: number;
  next_session_at: string | null;
  intake_submitted: string | null;
  plan_pending: number;
  proposals_pending: number;
  last_relance_at: string | null;
};

const LIST_COLUMNS = `
  e.id AS enrollment_id, p.id AS patient_id, p.first_name, p.last_name, p.birth_date, e.offer, e.status, e.goal_title,
  e.goal_date, e.coordinated_until, e.start_date,
  cur.id AS current_step_id, cur.title AS current_step_title, cur.profession AS current_step_profession,
  (SELECT COUNT(*) FROM sessions s WHERE s.enrollment_step_id = cur.id AND s.status = 'prevue') AS current_step_has_session,
  (SELECT COUNT(*) FROM enrollment_steps es WHERE es.enrollment_id = e.id AND es.status = 'realisee') AS done_steps,
  (SELECT COUNT(*) FROM enrollment_steps es WHERE es.enrollment_id = e.id AND es.status <> 'non_retenue') AS total_steps,
  (SELECT MIN(s.starts_at) FROM sessions s WHERE s.enrollment_id = e.id AND s.status = 'prevue' AND s.starts_at >= :now) AS next_session_at,
  (SELECT f.submitted_at FROM intake_forms f WHERE f.enrollment_id = e.id) AS intake_submitted,
  (SELECT COUNT(*) FROM enrollment_steps es WHERE es.enrollment_id = e.id AND es.title = 'Bilan de course (30 min)' AND es.status = 'realisee')
    - (SELECT COUNT(*) FROM reports r WHERE r.enrollment_id = e.id AND r.published_at IS NOT NULL) AS plan_pending,
  (SELECT COUNT(*) FROM care_team t WHERE t.enrollment_id = e.id AND t.status = 'proposee') AS proposals_pending,
  (SELECT MAX(r.created_at) FROM relances r WHERE r.enrollment_id = e.id) AS last_relance_at`;

const LIST_JOINS = `
  JOIN patients p ON p.id = e.patient_id
  LEFT JOIN enrollment_steps cur ON cur.enrollment_id = e.id AND cur.status = 'en_cours'`;

export type ListFilters = { offer?: string; status?: string; step?: string; q?: string; alert?: string };

function applyFilters<T extends ListRow>(rows: T[], filters: ListFilters, alerts: (r: T) => string[]) {
  const q = filters.q?.trim().toLowerCase();
  return rows.filter((r) => {
    if (filters.offer && r.offer !== filters.offer) return false;
    if (filters.status && r.status !== filters.status) return false;
    if (filters.step && r.current_step_title !== filters.step) return false;
    if (filters.alert === "1" && alerts(r).length === 0) return false;
    if (q && !`${r.first_name} ${r.last_name} ${r.goal_title}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

const STATUS_ORDER = "CASE e.status WHEN 'actif' THEN 0 WHEN 'en_pause' THEN 1 ELSE 2 END, p.last_name";

// ------------------------------------------------------- Practitioner: list

export type PractitionerListRow = ListRow & { last_pain: number | null; is_referent: number };

export async function listPatientsForPractitioner(practitionerId: string, filters: ListFilters = {}) {
  const rows = await all<PractitionerListRow>(
    `SELECT ${LIST_COLUMNS}, ct.is_referent,
            (SELECT c.pain FROM checkins c WHERE c.enrollment_id = e.id ORDER BY c.date DESC LIMIT 1) AS last_pain
       FROM care_team ct JOIN enrollments e ON e.id = ct.enrollment_id ${LIST_JOINS}
      WHERE ct.practitioner_id = :pr AND ct.status = 'acceptee'
      ORDER BY ${STATUS_ORDER}`,
    { now: new Date().toISOString(), pr: practitionerId },
  );
  return applyFilters(rows, filters, clinicalAlerts);
}

/** What a practitioner should look at — clinical signals, never shown to the coordinator. */
export function clinicalAlerts(r: Pick<PractitionerListRow, "status" | "last_pain" | "intake_submitted">) {
  const alerts: string[] = [];
  if (r.status === "termine") return alerts;
  if (!r.intake_submitted) alerts.push("Questionnaire non rempli");
  if (r.last_pain !== null && r.last_pain >= 5) alerts.push(`Douleur déclarée ${r.last_pain}/10`);
  if (r.status === "en_pause") alerts.push("Parcours en pause");
  return alerts;
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
  practitioner_name?: string;
};

export async function upcomingSessionsForPractitioner(practitionerId: string, limit = 6) {
  return await all<UpcomingSession>(
    `SELECT s.id, s.starts_at, s.duration_min, s.location, p.id AS patient_id, p.first_name, p.last_name, es.title AS step_title
       FROM sessions s
       JOIN enrollments e ON e.id = s.enrollment_id
       JOIN patients p ON p.id = e.patient_id
       LEFT JOIN enrollment_steps es ON es.id = s.enrollment_step_id
      WHERE s.practitioner_id = ? AND s.status = 'prevue' AND s.starts_at >= ?
      ORDER BY s.starts_at LIMIT ?`,
    practitionerId, new Date().toISOString(), limit,
  );
}

// -------------------------------------------------------- Practitioner: file

export type PractitionerPatientFile = {
  patient: PatientRow;
  enrollment: EnrollmentRow;
  team: TeamMember[];
  timeline: TimelineStep[];
  sessions: SessionRow[];
  notes: NoteRow[];
  hiddenNotesCount: number;
  reports: ReportRow[];
  checkins: CheckinRow[];
  intake: IntakeRow | null;
  intakeSections: IntakeSection[];
  hiddenIntakeSections: IntakeSection[];
  accessLogs: AccessLogRow[];
};

/**
 * Loads a patient file for a practitioner, or returns null (and logs a refused
 * access) when the patient has not accepted them in the care team.
 */
export async function getPatientFileForPractitioner(practitioner: PractitionerUser, patientId: string): Promise<PractitionerPatientFile | null> {
  const patient = await get<PatientRow>(PATIENT_SELECT, patientId);
  if (!patient) return null;
  const enrollment = await get<EnrollmentRow>(
    `${ENROLLMENT_SELECT}
       JOIN care_team ct ON ct.enrollment_id = e.id AND ct.practitioner_id = ? AND ct.status = 'acceptee'
      WHERE e.patient_id = ?
      ORDER BY e.start_date DESC LIMIT 1`,
    practitioner.id, patientId,
  );
  if (!enrollment) {
    await logAccess("practitioner", practitioner.id, patientId, "consultation_fiche", false);
    return null;
  }
  await logAccess("practitioner", practitioner.id, patientId, "consultation_fiche");

  // With the patient's opposition (CSP L1110-4 IV), practitioners keep only what
  // they produced themselves; nothing written by colleagues is shared.
  const opposed = enrollment.sharing_opposed === 1;
  const allNotes = await all<NoteRow>(
    `SELECT n.id, n.body, n.visibility, n.created_at, n.author_id, pr.profession,
            TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS author_name
       FROM notes n JOIN practitioners pr ON pr.id = n.author_id
      WHERE n.enrollment_id = ?
      ORDER BY n.created_at DESC`,
    enrollment.id,
  );
  const notes = allNotes.filter((n) => n.author_id === practitioner.id || (!opposed && n.visibility !== "privee"));
  const reports = (await getReports(enrollment.id)).filter(
    (r) => r.author_id === practitioner.id || (!opposed && r.published_at !== null),
  );
  const intakeSections = visibleSectionsFor(practitioner.profession);

  return {
    patient,
    enrollment,
    team: await getTeam(enrollment.id),
    timeline: await getTimeline(enrollment.id),
    sessions: await getSessions(enrollment.id),
    notes,
    hiddenNotesCount: opposed ? allNotes.filter((n) => n.author_id !== practitioner.id && n.visibility !== "privee").length : 0,
    reports,
    checkins: await getCheckins(enrollment.id),
    intake: await getIntake(enrollment.id),
    intakeSections,
    hiddenIntakeSections: visibleSectionsFor("patient").filter((s) => !intakeSections.includes(s)),
    accessLogs: await getAccessLogs(patientId, 15),
  };
}

// --------------------------------------------------------- Coordinator: list

export async function listForCoordinator(coordinatorId: string, filters: ListFilters = {}) {
  const rows = await all<ListRow>(
    `SELECT ${LIST_COLUMNS}
       FROM enrollments e ${LIST_JOINS}
      WHERE e.coordinator_id = :co
      ORDER BY ${STATUS_ORDER}`,
    { now: new Date().toISOString(), co: coordinatorId },
  );
  return applyFilters(rows, filters, coordinationTodos);
}

/** Logistics to-do list for the coordinator — derived only from non-clinical data. */
export function coordinationTodos(r: ListRow) {
  const todos: string[] = [];
  if (r.status !== "actif") return todos;
  if (!r.intake_submitted) {
    const days = Math.floor((Date.now() - new Date(`${r.start_date}T00:00:00`).getTime()) / 86_400_000);
    todos.push(`Questionnaire non envoyé (J+${days})`);
  }
  if (r.proposals_pending > 0) todos.push("Proposition d'équipe en attente du patient");
  if (r.plan_pending > 0) todos.push("Plan d'action à remettre");
  if (r.current_step_profession === "patient" && r.current_step_title === "Choix de la suite") todos.push("Choix de la suite en attente");
  if (r.current_step_profession === "coordinateur") todos.push(`À faire : ${r.current_step_title?.toLowerCase()}`);
  if (r.current_step_id && r.current_step_has_session === 0 && r.current_step_profession && !["patient", "coordinateur"].includes(r.current_step_profession)) {
    todos.push("Séance à planifier");
  }
  if (r.coordinated_until) {
    const left = Math.round((new Date(`${r.coordinated_until}T12:00:00`).getTime() - Date.now()) / 86_400_000);
    if (left >= 0 && left <= 30) todos.push(`Fin de coordination dans ${left} j`);
  }
  return todos;
}

export async function upcomingSessionsForCoordinator(coordinatorId: string, limit = 8) {
  return await all<UpcomingSession>(
    `SELECT s.id, s.starts_at, s.duration_min, s.location, p.id AS patient_id, p.first_name, p.last_name, es.title AS step_title,
            TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS practitioner_name
       FROM sessions s
       JOIN enrollments e ON e.id = s.enrollment_id
       JOIN patients p ON p.id = e.patient_id
       JOIN practitioners pr ON pr.id = s.practitioner_id
       LEFT JOIN enrollment_steps es ON es.id = s.enrollment_step_id
      WHERE e.coordinator_id = ? AND s.status = 'prevue' AND s.starts_at >= ?
      ORDER BY s.starts_at LIMIT ?`,
    coordinatorId, new Date().toISOString(), limit,
  );
}

// --------------------------------------------------------- Coordinator: file

export type RelanceRow = { id: string; channel: "email" | "sms" | "telephone"; reason: string; created_at: string };
export type PartnerRow = { id: string; first_name: string; last_name: string; title: string; profession: Profession; specialty: string; location: string };
export type CatalogRow = { id: string; title: string; description: string; profession: Profession };

export type LogisticsFile = {
  patient: PatientRow;
  enrollment: EnrollmentRow;
  team: TeamMember[];
  timeline: TimelineStep[];
  sessions: SessionRow[];
  intakeSubmittedAt: string | null;
  organisation: IntakeSection[];
  organisationAnswers: IntakeAnswers;
  reportPublished: boolean;
  relances: RelanceRow[];
  partners: PartnerRow[];
  catalog: CatalogRow[];
  accessLogs: AccessLogRow[];
};

/** The coordinator's view: logistics only. Clinical fields are never selected. */
export async function getLogisticsFile(coordinator: CoordinatorUser, patientId: string): Promise<LogisticsFile | null> {
  const patient = await get<PatientRow>(PATIENT_SELECT, patientId);
  if (!patient) return null;
  const enrollment = await get<EnrollmentRow>(
    `${ENROLLMENT_SELECT} WHERE e.patient_id = ? AND e.coordinator_id = ? ORDER BY e.start_date DESC LIMIT 1`,
    patientId, coordinator.id,
  );
  if (!enrollment) {
    await logAccess("coordinator", coordinator.id, patientId, "consultation_logistique", false);
    return null;
  }
  await logAccess("coordinator", coordinator.id, patientId, "consultation_logistique");

  const intake = await getIntake(enrollment.id);
  const organisation = visibleSectionsFor("coordinateur");
  const organisationAnswers: IntakeAnswers = {};
  for (const section of organisation) for (const f of section.fields) organisationAnswers[f.id] = intake?.answers[f.id] ?? null;

  return {
    patient,
    enrollment,
    team: await getTeam(enrollment.id),
    // Step titles and statuses are logistics; the practitioners' summaries are not.
    timeline: (await getTimeline(enrollment.id)).map((s) => ({ ...s, summary: "" })),
    sessions: await getSessions(enrollment.id),
    intakeSubmittedAt: intake?.submitted_at ?? null,
    organisation,
    organisationAnswers,
    reportPublished: Boolean(get("SELECT 1 AS ok FROM reports WHERE enrollment_id = ? AND published_at IS NOT NULL", enrollment.id)),
    relances: await all<RelanceRow>("SELECT id, channel, reason, created_at FROM relances WHERE enrollment_id = ? ORDER BY created_at DESC", enrollment.id),
    partners: await all<PartnerRow>(
      `SELECT id, first_name, last_name, title, profession, specialty, location FROM practitioners
        WHERE id NOT IN (SELECT practitioner_id FROM care_team WHERE enrollment_id = ?)
        ORDER BY profession, last_name`,
      enrollment.id,
    ),
    catalog: await all<CatalogRow>("SELECT * FROM step_catalog ORDER BY profession, title"),
    accessLogs: await getAccessLogs(patientId, 15),
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
  reports: ReportRow[];
  shares: ShareRow[];
  checkins: CheckinRow[];
  intake: IntakeRow | null;
  accessLogs: AccessLogRow[];
};

export async function getPatientSpace(patientId: string): Promise<PatientSpace | null> {
  const patient = await get<PatientRow>(PATIENT_SELECT, patientId);
  const enrollment = await get<EnrollmentRow>(
    `${ENROLLMENT_SELECT} WHERE e.patient_id = ? ORDER BY CASE e.status WHEN 'termine' THEN 1 ELSE 0 END, e.start_date DESC LIMIT 1`,
    patientId,
  );
  if (!patient || !enrollment) return null;
  return {
    patient,
    enrollment,
    team: await getTeam(enrollment.id),
    timeline: await getTimeline(enrollment.id),
    sessions: await getSessions(enrollment.id),
    // The patient sees the notes written for them, never internal team notes.
    notes: await all<NoteRow>(
      `SELECT n.id, n.body, n.visibility, n.created_at, n.author_id, pr.profession,
              TRIM(pr.title || ' ' || pr.first_name || ' ' || pr.last_name) AS author_name
         FROM notes n JOIN practitioners pr ON pr.id = n.author_id
        WHERE n.enrollment_id = ? AND n.visibility = 'patient'
        ORDER BY n.created_at DESC`,
      enrollment.id,
    ),
    reports: (await getReports(enrollment.id)).filter((r) => r.published_at !== null),
    shares: await all<ShareRow>("SELECT * FROM external_shares WHERE enrollment_id = ? ORDER BY consent_at DESC", enrollment.id),
    checkins: await getCheckins(enrollment.id),
    intake: await getIntake(enrollment.id),
    accessLogs: await getAccessLogs(patientId),
  };
}

// ------------------------------------------------------------------ Reports

export type ReportView = { report: ReportRow; patient: PatientRow; enrollment: EnrollmentRow };

type Viewer =
  | { type: "patient"; id: string }
  | { type: "practitioner"; user: PractitionerUser }
  | { type: "coordinator"; id: string };

/** A report as its reader is allowed to see it, or null. Every attempt is logged. */
export async function getReportFor(viewer: Viewer, reportId: string): Promise<ReportView | null> {
  const raw = await get<Omit<ReportRow, "findings"> & { findings: string }>(`${REPORT_SELECT} WHERE r.id = ?`, reportId);
  if (!raw) return null;
  const report = parseReport(raw);
  const enrollment = (await get<EnrollmentRow>(`${ENROLLMENT_SELECT} WHERE e.id = ?`, report.enrollment_id))!;
  const patient = (await get<PatientRow>(PATIENT_SELECT, enrollment.patient_id))!;

  let allowed = false;
  let actorType: ActorType = "patient";
  let actorId = "";
  if (viewer.type === "patient") {
    actorId = viewer.id;
    allowed = viewer.id === patient.id && report.published_at !== null;
  } else if (viewer.type === "practitioner") {
    actorType = "practitioner";
    actorId = viewer.user.id;
    allowed =
      await isInCareTeam(viewer.user.id, enrollment.id) &&
      (report.author_id === viewer.user.id || (report.published_at !== null && enrollment.sharing_opposed === 0));
  } else {
    // The coordinator organises the pathway but is not a health professional.
    actorType = "coordinator";
    actorId = viewer.id;
  }
  await logAccess(actorType, actorId, patient.id, "lecture_compte_rendu", allowed);
  return allowed ? { report, patient, enrollment } : null;
}

/** A report opened through an external share link (practitioner outside the team). */
export async function getSharedReport(token: string): Promise<(ReportView & { share: ShareRow }) | null> {
  const share = await get<ShareRow & { enrollment_id: string }>("SELECT * FROM external_shares WHERE token = ?", token);
  if (!share || share.revoked_at) return null;
  const raw = await get<Omit<ReportRow, "findings"> & { findings: string }>(`${REPORT_SELECT} WHERE r.id = ? AND r.published_at IS NOT NULL`, share.report_id);
  if (!raw) return null;
  const enrollment = (await get<EnrollmentRow>(`${ENROLLMENT_SELECT} WHERE e.id = ?`, share.enrollment_id))!;
  const patient = (await get<PatientRow>(PATIENT_SELECT, enrollment.patient_id))!;
  await run("UPDATE external_shares SET last_access_at = ? WHERE id = ?", new Date().toISOString(), share.id);
  await logAccess("external", share.recipient_name, patient.id, "lecture_partage_externe");
  return { report: parseReport(raw), patient, enrollment, share };
}

export const DIMENSIONS = BILAN_DIMENSIONS;

// ---------------------------------------------------------------- Demo login

export async function listPersonas() {
  const coordinators = await all<CoordinatorUser & { patient_count: number }>(
    `SELECT co.*, (SELECT COUNT(*) FROM enrollments e WHERE e.coordinator_id = co.id AND e.status <> 'termine') AS patient_count
       FROM coordinators co`,
  );
  const practitioners = await all<PractitionerUser & { patient_count: number }>(
    `SELECT pr.*, (SELECT COUNT(*) FROM care_team ct WHERE ct.practitioner_id = pr.id AND ct.status = 'acceptee') AS patient_count
       FROM practitioners pr
      ORDER BY CASE pr.profession WHEN 'kine' THEN 0 WHEN 'medecin' THEN 1 ELSE 2 END, pr.last_name`,
  );
  const patients = await all<{ id: string; first_name: string; last_name: string; email: string; offer: Offer; status: EnrollmentStatus; goal_title: string }>(
    `SELECT p.id, p.first_name, p.last_name, p.email, e.offer, e.status, e.goal_title
       FROM patients p JOIN enrollments e ON e.patient_id = p.id
      ORDER BY CASE e.status WHEN 'actif' THEN 0 WHEN 'en_pause' THEN 1 ELSE 2 END, e.offer, p.last_name`,
  );
  return { coordinators, practitioners, patients };
}
