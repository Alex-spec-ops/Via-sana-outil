"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireCoordinator, requirePatient, requirePractitioner, startSession } from "@/lib/auth";
import { db, get, resetDemoData, run, transaction } from "@/lib/db";
import { BILAN_DIMENSIONS, COORDINATION_OFFER, INTAKE_SECTIONS, type IntakeAnswers } from "@/lib/domain";
import { addCatalogStep, advance, completeStep, instantiatePhase, skipStep } from "@/lib/pathway";
import { isInCareTeam, logAccess } from "@/lib/queries";

function text(formData: FormData, key: string, max = 2000) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function numberOrNull(formData: FormData, key: string, min: number, max: number) {
  const raw = text(formData, key, 20);
  if (raw === "") return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function refresh() {
  revalidatePath("/", "layout");
}

function startsAt(formData: FormData) {
  const d = new Date(`${text(formData, "date", 10)}T${text(formData, "time", 5) || "09:00"}:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

type StepRow = { id: string; enrollment_id: string; profession: string; title: string; status: string; optional: number; practitioner_id: string | null };
const STEP_SELECT = "SELECT id, enrollment_id, profession, title, status, optional, practitioner_id FROM enrollment_steps WHERE id = ?";

// ------------------------------------------------------------------ Session

export async function loginAs(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id", 100);
  if (type === "coordinator" && get("SELECT 1 AS ok FROM coordinators WHERE id = ?", id)) {
    await startSession({ type, id });
    redirect("/coordination");
  }
  if (type === "practitioner" && get("SELECT 1 AS ok FROM practitioners WHERE id = ?", id)) {
    await startSession({ type, id });
    redirect("/praticien");
  }
  if (type === "patient" && get("SELECT 1 AS ok FROM patients WHERE id = ?", id)) {
    await startSession({ type, id });
    logAccess("patient", id, id, "connexion");
    // A new client lands straight on the questionnaire, the first step of the pathway.
    const sent = get(
      `SELECT 1 AS ok FROM intake_forms f JOIN enrollments e ON e.id = f.enrollment_id
        WHERE e.patient_id = ? AND f.submitted_at IS NOT NULL`,
      id,
    );
    redirect(sent ? "/patient" : "/patient/formulaire");
  }
  redirect("/");
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function resetDemo() {
  // Demo-only convenience: there is nothing but fictional data in this database.
  resetDemoData();
  await endSession();
  refresh();
  redirect("/");
}

// ------------------------------------------------------------- Practitioner

/** Resolves the enrollment and verifies the patient accepted this practitioner. */
async function practitionerOn(enrollmentId: string, action: string) {
  const practitioner = await requirePractitioner();
  const enrollment = get<{ id: string; patient_id: string }>("SELECT id, patient_id FROM enrollments WHERE id = ?", enrollmentId);
  if (!enrollment) throw new Error("Parcours introuvable");
  if (!isInCareTeam(practitioner.id, enrollment.id)) {
    logAccess("practitioner", practitioner.id, enrollment.patient_id, action, false);
    throw new Error("Accès refusé : vous ne faites pas partie de l'équipe de soins de ce patient.");
  }
  logAccess("practitioner", practitioner.id, enrollment.patient_id, action);
  return { practitioner, enrollment };
}

export async function addNote(formData: FormData) {
  const { practitioner, enrollment } = await practitionerOn(text(formData, "enrollmentId", 100), "ajout_note");
  const body = text(formData, "body", 4000);
  const visibility = text(formData, "visibility");
  if (!body || !["equipe", "privee", "patient"].includes(visibility)) return;
  run(
    "INSERT INTO notes (id, enrollment_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    randomUUID(), enrollment.id, practitioner.id, body, visibility, new Date().toISOString(),
  );
  refresh();
}

export async function updateStep(formData: FormData) {
  const step = get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  if (!step) return;
  const { practitioner } = await practitionerOn(step.enrollment_id, "mise_a_jour_etape");
  // A step is closed by the profession that performs it, or by the referent.
  const referent = get("SELECT 1 AS ok FROM care_team WHERE enrollment_id = ? AND practitioner_id = ? AND is_referent = 1", step.enrollment_id, practitioner.id);
  if (step.profession !== practitioner.profession && !referent) return;
  // The action plan is closed by publishing the report, not by hand.
  if (step.title === "Plan d'action remis") return;
  const status = text(formData, "status");
  transaction(db, () => {
    if (status === "realisee") {
      completeStep(db, step.id, text(formData, "summary", 1000));
    } else if (status === "en_cours") {
      run("UPDATE enrollment_steps SET status = 'a_venir' WHERE enrollment_id = ? AND status = 'en_cours'", step.enrollment_id);
      run("UPDATE enrollment_steps SET status = 'en_cours', practitioner_id = COALESCE(practitioner_id, ?) WHERE id = ?", practitioner.id, step.id);
    }
  });
  refresh();
}

export async function scheduleSession(formData: FormData) {
  const { practitioner, enrollment } = await practitionerOn(text(formData, "enrollmentId", 100), "planification_seance");
  const when = startsAt(formData);
  if (!when) return;
  const stepId = text(formData, "stepId", 100);
  const step = stepId ? get<{ id: string }>("SELECT id FROM enrollment_steps WHERE id = ? AND enrollment_id = ?", stepId, enrollment.id) : undefined;
  run(
    `INSERT INTO sessions (id, enrollment_id, enrollment_step_id, practitioner_id, starts_at, duration_min, location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'prevue')`,
    randomUUID(), enrollment.id, step?.id ?? null, practitioner.id, when, numberOrNull(formData, "duration", 15, 180) ?? 30, practitioner.location,
  );
  refresh();
}

export async function setSessionStatus(formData: FormData) {
  const session = get<{ id: string; enrollment_id: string; practitioner_id: string }>(
    "SELECT id, enrollment_id, practitioner_id FROM sessions WHERE id = ?",
    text(formData, "sessionId", 100),
  );
  if (!session) return;
  const { practitioner } = await practitionerOn(session.enrollment_id, "mise_a_jour_seance");
  const status = text(formData, "status");
  // Only the practitioner who owns the appointment can close or cancel it.
  if (session.practitioner_id !== practitioner.id || !["realisee", "annulee"].includes(status)) return;
  run("UPDATE sessions SET status = ? WHERE id = ?", status, session.id);
  refresh();
}

/** Writes (or publishes) the structured "bilan de course" report — the PDF action plan. */
export async function saveReport(formData: FormData) {
  const { practitioner, enrollment } = await practitionerOn(text(formData, "enrollmentId", 100), "redaction_compte_rendu");
  if (practitioner.profession !== "kine") return;
  const findings: Record<string, string> = {};
  for (const d of BILAN_DIMENSIONS) findings[d.id] = text(formData, `f-${d.id}`, 1000);
  const publish = text(formData, "intent") === "publish";
  const now = new Date().toISOString();
  const existing = get<{ id: string; published_at: string | null }>(
    "SELECT id, published_at FROM reports WHERE enrollment_id = ? AND author_id = ? AND title = 'Bilan de course'",
    enrollment.id, practitioner.id,
  );
  const planStep = get<{ id: string; status: string }>(
    "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Plan d''action remis'", enrollment.id,
  );
  const bilanStep = get<{ id: string; status: string }>(
    "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Bilan de course (30 min)'", enrollment.id,
  );
  transaction(db, () => {
    const fields = [JSON.stringify(findings), text(formData, "recommendations", 2000), text(formData, "action_plan", 2000)];
    if (existing) {
      run(
        "UPDATE reports SET findings = ?, recommendations = ?, action_plan = ?, published_at = COALESCE(published_at, ?) WHERE id = ?",
        ...fields, publish ? now : null, existing.id,
      );
    } else {
      run(
        `INSERT INTO reports (id, enrollment_id, enrollment_step_id, author_id, title, findings, recommendations, action_plan, created_at, published_at)
         VALUES (?, ?, ?, ?, 'Bilan de course', ?, ?, ?, ?, ?)`,
        randomUUID(), enrollment.id, planStep?.id ?? null, practitioner.id, ...fields, now, publish ? now : null,
      );
    }
    if (publish) {
      if (bilanStep && bilanStep.status !== "realisee") completeStep(db, bilanStep.id, "Bilan réalisé, compte rendu publié.");
      if (planStep && planStep.status !== "realisee") completeStep(db, planStep.id);
    }
  });
  refresh();
}

// -------------------------------------------------------------- Coordinator

/** The coordinator only acts on the patients they coordinate — and on logistics only. */
async function coordinatorOn(enrollmentId: string, action: string) {
  const coordinator = await requireCoordinator();
  const enrollment = get<{ id: string; patient_id: string }>(
    "SELECT id, patient_id FROM enrollments WHERE id = ? AND coordinator_id = ?",
    enrollmentId, coordinator.id,
  );
  if (!enrollment) throw new Error("Parcours introuvable");
  logAccess("coordinator", coordinator.id, enrollment.patient_id, action);
  return { coordinator, enrollment };
}

export async function proposeMember(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "proposition_praticien");
  const practitionerId = text(formData, "practitionerId", 100);
  if (!get("SELECT 1 AS ok FROM practitioners WHERE id = ?", practitionerId)) return;
  // The practitioner gets no access until the patient accepts (CSP L1110-12, 2°).
  run(
    `INSERT INTO care_team (enrollment_id, practitioner_id, status, is_referent, proposed_at)
     VALUES (?, ?, 'proposee', 0, ?)
     ON CONFLICT (enrollment_id, practitioner_id) DO UPDATE SET status = 'proposee', proposed_at = excluded.proposed_at, decided_at = NULL`,
    enrollment.id, practitionerId, new Date().toISOString(),
  );
  refresh();
}

export async function addPlanStep(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "ajout_etape");
  const catalog = get<{ profession: string }>("SELECT profession FROM step_catalog WHERE id = ?", text(formData, "catalogId", 100));
  if (!catalog) return;
  const week = numberOrNull(formData, "week", 0, 52) ?? 4;
  const practitioner = get<{ id: string }>(
    `SELECT pr.id FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ? AND ct.status = 'acceptee' AND pr.profession = ? ORDER BY ct.is_referent DESC LIMIT 1`,
    enrollment.id, catalog.profession,
  );
  transaction(db, () => addCatalogStep(db, enrollment.id, text(formData, "catalogId", 100), Math.round(week), practitioner?.id ?? null));
  refresh();
}

export async function coordinateSession(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "planification_seance");
  const step = get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  const when = startsAt(formData);
  if (!step || step.enrollment_id !== enrollment.id || !when) return;
  const practitionerId = text(formData, "practitionerId", 100) || step.practitioner_id || "";
  const practitioner = get<{ id: string; location: string }>(
    `SELECT pr.id, pr.location FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ? AND ct.practitioner_id = ? AND ct.status = 'acceptee'`,
    enrollment.id, practitionerId,
  );
  if (!practitioner) return;
  transaction(db, () => {
    run("UPDATE enrollment_steps SET practitioner_id = COALESCE(practitioner_id, ?) WHERE id = ?", practitioner.id, step.id);
    run(
      `INSERT INTO sessions (id, enrollment_id, enrollment_step_id, practitioner_id, starts_at, duration_min, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'prevue')`,
      randomUUID(), enrollment.id, step.id, practitioner.id, when, numberOrNull(formData, "duration", 15, 180) ?? 30, practitioner.location,
    );
  });
  refresh();
}

export async function skipOptionalStep(formData: FormData) {
  const step = get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  if (!step || step.optional !== 1) return;
  await coordinatorOn(step.enrollment_id, "etape_non_retenue");
  transaction(db, () => skipStep(db, step.id));
  refresh();
}

export async function completeCoordinationStep(formData: FormData) {
  const step = get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  if (!step || step.profession !== "coordinateur") return;
  await coordinatorOn(step.enrollment_id, "mise_a_jour_etape");
  transaction(db, () => completeStep(db, step.id));
  refresh();
}

export async function addRelance(formData: FormData) {
  const { coordinator, enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "relance");
  const channel = text(formData, "channel");
  const reason = text(formData, "reason", 300);
  if (!["email", "sms", "telephone"].includes(channel) || !reason) return;
  run(
    "INSERT INTO relances (id, enrollment_id, coordinator_id, channel, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    randomUUID(), enrollment.id, coordinator.id, channel, reason, new Date().toISOString(),
  );
  refresh();
}

export async function setEnrollmentStatus(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "changement_statut_parcours");
  const status = text(formData, "status");
  if (!["actif", "en_pause", "termine"].includes(status)) return;
  run("UPDATE enrollments SET status = ? WHERE id = ?", status, enrollment.id);
  refresh();
}

// ------------------------------------------------------------------ Patient

async function currentEnrollment() {
  const patient = await requirePatient();
  const enrollment = get<{ id: string; offer: string; status: string }>(
    `SELECT id, offer, status FROM enrollments WHERE patient_id = ?
      ORDER BY CASE status WHEN 'termine' THEN 1 ELSE 0 END, start_date DESC LIMIT 1`,
    patient.id,
  );
  if (!enrollment) throw new Error("Aucun parcours");
  return { patient, enrollment };
}

export async function saveIntake(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const answers: IntakeAnswers = {};
  for (const section of INTAKE_SECTIONS) {
    for (const field of section.fields) {
      if (field.type === "boolean") {
        const v = text(formData, field.id);
        answers[field.id] = v === "oui" ? true : v === "non" ? false : null;
      } else if (field.type === "number") {
        answers[field.id] = numberOrNull(formData, field.id, field.min ?? 0, field.max ?? 10000);
      } else if (field.type === "select") {
        const v = text(formData, field.id);
        answers[field.id] = field.options.includes(v) ? v : null;
      } else {
        answers[field.id] = text(formData, field.id, field.type === "textarea" ? 2000 : 200);
      }
    }
  }
  const submit = text(formData, "intent") === "submit";
  const now = new Date().toISOString();

  transaction(db, () => {
    run(
      `INSERT INTO intake_forms (enrollment_id, answers, submitted_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (enrollment_id) DO UPDATE SET answers = excluded.answers, updated_at = excluded.updated_at,
         submitted_at = COALESCE(intake_forms.submitted_at, excluded.submitted_at)`,
      enrollment.id, JSON.stringify(answers), submit ? now : null, now,
    );
    if (!submit) return;
    const formStep = get<{ id: string; status: string }>(
      "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Questionnaire en ligne'", enrollment.id,
    );
    if (formStep && formStep.status !== "realisee") completeStep(db, formStep.id);
    // With a prescription already in hand, the medical teleconsultation is not needed.
    if (answers.ordonnance === true) {
      const tele = get<{ id: string; status: string }>(
        "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Téléconsultation médecin'", enrollment.id,
      );
      if (tele && (tele.status === "a_venir" || tele.status === "en_cours")) skipStep(db, tele.id);
    }
  });
  logAccess("patient", patient.id, patient.id, submit ? "envoi_formulaire" : "brouillon_formulaire");
  refresh();
  redirect(submit ? "/patient?formulaire=envoye" : "/patient/formulaire?brouillon=1");
}

export async function chooseNext(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const choice = text(formData, "choice");
  const step = get<{ id: string; status: string }>(
    "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Choix de la suite'", enrollment.id,
  );
  if (!step || step.status === "realisee" || !["parcours", "stop"].includes(choice)) return;
  transaction(db, () => {
    run("UPDATE enrollment_steps SET status = 'realisee', completed_at = ? WHERE id = ?", new Date().toISOString(), step.id);
    if (choice === "parcours") {
      const until = new Date();
      until.setMonth(until.getMonth() + COORDINATION_OFFER.months);
      run("UPDATE enrollments SET offer = 'parcours', coordinated_until = ? WHERE id = ?", until.toISOString().slice(0, 10), enrollment.id);
      instantiatePhase(db, enrollment.id, "parcours");
      advance(db, enrollment.id);
    } else {
      run("UPDATE enrollments SET status = 'termine' WHERE id = ?", enrollment.id);
    }
  });
  logAccess("patient", patient.id, patient.id, choice === "parcours" ? "choix_parcours_coordonne" : "choix_arret_bilan");
  refresh();
}

export async function decideTeamMember(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const practitionerId = text(formData, "practitionerId", 100);
  const decision = text(formData, "decision") === "acceptee" ? "acceptee" : "refusee";
  const member = get<{ profession: string }>(
    `SELECT pr.profession FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ? AND ct.practitioner_id = ? AND ct.status = 'proposee'`,
    enrollment.id, practitionerId,
  );
  if (!member) return;
  transaction(db, () => {
    run("UPDATE care_team SET status = ?, decided_at = ? WHERE enrollment_id = ? AND practitioner_id = ?",
      decision, new Date().toISOString(), enrollment.id, practitionerId);
    if (decision === "acceptee") {
      run("UPDATE enrollment_steps SET practitioner_id = ? WHERE enrollment_id = ? AND profession = ? AND practitioner_id IS NULL",
        practitionerId, enrollment.id, member.profession);
    }
  });
  logAccess("patient", patient.id, patient.id, decision === "acceptee" ? "acceptation_praticien" : "refus_praticien");
  refresh();
}

export async function addCheckin(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const km = numberOrNull(formData, "weekly_km", 0, 400);
  const pain = numberOrNull(formData, "pain", 0, 10);
  const fatigue = numberOrNull(formData, "fatigue", 0, 10);
  if (km === null && pain === null && fatigue === null) return;
  run(
    `INSERT INTO checkins (id, enrollment_id, author_type, author_id, date, weekly_km, pain, fatigue, comment)
     VALUES (?, ?, 'patient', ?, ?, ?, ?, ?, ?)`,
    randomUUID(), enrollment.id, patient.id, new Date().toISOString().slice(0, 10),
    km, pain === null ? null : Math.round(pain), fatigue === null ? null : Math.round(fatigue), text(formData, "comment", 500),
  );
  refresh();
}

export async function setSharingOpposition(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const opposed = text(formData, "opposed") === "1";
  run("UPDATE enrollments SET sharing_opposed = ?, consent_updated_at = ? WHERE id = ?", opposed ? 1 : 0, new Date().toISOString(), enrollment.id);
  logAccess("patient", patient.id, patient.id, opposed ? "opposition_partage" : "levee_opposition_partage");
  refresh();
}

/** Sharing outside the care team requires the patient's prior consent (CSP L1110-4 III). */
export async function createShare(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const report = get<{ id: string }>(
    "SELECT id FROM reports WHERE id = ? AND enrollment_id = ? AND published_at IS NOT NULL",
    text(formData, "reportId", 100), enrollment.id,
  );
  const name = text(formData, "recipient_name", 120);
  const role = text(formData, "recipient_role", 120);
  if (!report || !name || !role || text(formData, "consent") !== "1") return;
  run(
    `INSERT INTO external_shares (id, enrollment_id, report_id, recipient_name, recipient_role, token, consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), enrollment.id, report.id, name, role, randomBytes(18).toString("base64url"), new Date().toISOString(),
  );
  logAccess("patient", patient.id, patient.id, "partage_externe");
  refresh();
}

export async function revokeShare(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  run("UPDATE external_shares SET revoked_at = ? WHERE id = ? AND enrollment_id = ? AND revoked_at IS NULL",
    new Date().toISOString(), text(formData, "shareId", 100), enrollment.id);
  logAccess("patient", patient.id, patient.id, "revocation_partage");
  refresh();
}
