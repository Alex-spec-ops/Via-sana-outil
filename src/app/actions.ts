"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requirePatient, requirePractitioner, startSession } from "@/lib/auth";
import { get, run, db, resetDemoData, transaction } from "@/lib/db";
import { INTAKE_SECTIONS, type IntakeAnswers } from "@/lib/domain";
import { isInCareTeam, logAccess } from "@/lib/queries";

function text(formData: FormData, key: string, max = 2000) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function intOrNull(formData: FormData, key: string, min: number, max: number) {
  const raw = text(formData, key, 20);
  if (raw === "") return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return Math.min(max, Math.max(min, n));
}

function refresh() {
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------------ Session

export async function loginAs(formData: FormData) {
  const type = text(formData, "type");
  const id = text(formData, "id", 100);
  if (type === "practitioner" && get("SELECT 1 AS ok FROM practitioners WHERE id = ?", id)) {
    await startSession({ type, id });
    redirect("/praticien");
  }
  if (type === "patient" && get("SELECT 1 AS ok FROM patients WHERE id = ?", id)) {
    await startSession({ type, id });
    logAccess("patient", id, id, "connexion");
    redirect("/patient");
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

/** Resolves the enrollment and verifies the practitioner is in its care team. */
async function authorisedEnrollment(enrollmentId: string, action: string) {
  const practitioner = await requirePractitioner();
  const enrollment = get<{ id: string; patient_id: string }>(
    "SELECT id, patient_id FROM enrollments WHERE id = ?",
    enrollmentId,
  );
  if (!enrollment) throw new Error("Parcours introuvable");
  if (!isInCareTeam(practitioner.id, enrollment.id)) {
    logAccess("practitioner", practitioner.id, enrollment.patient_id, action, false);
    throw new Error("Accès refusé : vous ne faites pas partie de l'équipe de soins de ce patient.");
  }
  logAccess("practitioner", practitioner.id, enrollment.patient_id, action);
  return { practitioner, enrollment };
}

export async function addNote(formData: FormData) {
  const { practitioner, enrollment } = await authorisedEnrollment(text(formData, "enrollmentId", 100), "ajout_note");
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
  const stepId = text(formData, "stepId", 100);
  const step = get<{ id: string; enrollment_id: string; profession: string }>(
    `SELECT es.id, es.enrollment_id, ps.profession
       FROM enrollment_steps es JOIN pathway_steps ps ON ps.id = es.step_id WHERE es.id = ?`,
    stepId,
  );
  if (!step) return;
  const { practitioner } = await authorisedEnrollment(step.enrollment_id, "mise_a_jour_etape");
  // A step is closed by the profession that performs it, or by the referent.
  const referent = get("SELECT 1 AS ok FROM care_team WHERE enrollment_id = ? AND practitioner_id = ? AND is_referent = 1", step.enrollment_id, practitioner.id);
  if (step.profession !== practitioner.profession && !referent) return;
  const status = text(formData, "status");
  if (!["a_venir", "en_cours", "realisee"].includes(status)) return;
  const summary = text(formData, "summary", 1000);

  transaction(db, () => {
    run(
      `UPDATE enrollment_steps
          SET status = ?, completed_at = ?, summary = CASE WHEN ? <> '' THEN ? ELSE summary END,
              practitioner_id = COALESCE(practitioner_id, ?)
        WHERE id = ?`,
      status, status === "realisee" ? new Date().toISOString() : null, summary, summary, practitioner.id, step.id,
    );
    // Keep exactly one step "en cours": when a step is completed, its pending
    // appointments are closed and the next pending step becomes the current one.
    if (status === "realisee") {
      run("UPDATE sessions SET status = 'realisee' WHERE enrollment_step_id = ? AND status = 'prevue'", step.id);
      const current = get("SELECT 1 AS ok FROM enrollment_steps WHERE enrollment_id = ? AND status = 'en_cours'", step.enrollment_id);
      if (!current) {
        const next = get<{ id: string }>(
          `SELECT es.id FROM enrollment_steps es JOIN pathway_steps ps ON ps.id = es.step_id
            WHERE es.enrollment_id = ? AND es.status = 'a_venir' ORDER BY ps.position LIMIT 1`,
          step.enrollment_id,
        );
        if (next) run("UPDATE enrollment_steps SET status = 'en_cours' WHERE id = ?", next.id);
      }
    }
  });
  refresh();
}

export async function scheduleSession(formData: FormData) {
  const { practitioner, enrollment } = await authorisedEnrollment(text(formData, "enrollmentId", 100), "planification_seance");
  const date = text(formData, "date", 10);
  const time = text(formData, "time", 5) || "09:00";
  const startsAt = new Date(`${date}T${time}:00`);
  if (Number.isNaN(startsAt.getTime())) return;
  const stepId = text(formData, "stepId", 100);
  const step = stepId
    ? get<{ id: string }>("SELECT id FROM enrollment_steps WHERE id = ? AND enrollment_id = ?", stepId, enrollment.id)
    : undefined;
  run(
    `INSERT INTO sessions (id, enrollment_id, enrollment_step_id, practitioner_id, starts_at, duration_min, location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'prevue')`,
    randomUUID(), enrollment.id, step?.id ?? null, practitioner.id, startsAt.toISOString(),
    intOrNull(formData, "duration", 15, 180) ?? 45, text(formData, "location", 120) || "Centre Via Sana",
  );
  refresh();
}

export async function setSessionStatus(formData: FormData) {
  const session = get<{ id: string; enrollment_id: string; practitioner_id: string }>(
    "SELECT id, enrollment_id, practitioner_id FROM sessions WHERE id = ?",
    text(formData, "sessionId", 100),
  );
  if (!session) return;
  const { practitioner } = await authorisedEnrollment(session.enrollment_id, "mise_a_jour_seance");
  const status = text(formData, "status");
  // Only the practitioner who owns the appointment can close or cancel it.
  if (session.practitioner_id !== practitioner.id || !["realisee", "annulee"].includes(status)) return;
  run("UPDATE sessions SET status = ? WHERE id = ?", status, session.id);
  refresh();
}

export async function setEnrollmentStatus(formData: FormData) {
  const { enrollment } = await authorisedEnrollment(text(formData, "enrollmentId", 100), "changement_statut_parcours");
  const status = text(formData, "status");
  if (!["actif", "en_pause", "termine"].includes(status)) return;
  run("UPDATE enrollments SET status = ? WHERE id = ?", status, enrollment.id);
  refresh();
}

// ------------------------------------------------------------------ Patient

async function currentEnrollment() {
  const patient = await requirePatient();
  const enrollment = get<{ id: string }>(
    `SELECT id FROM enrollments WHERE patient_id = ?
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
        answers[field.id] = intOrNull(formData, field.id, field.min ?? 0, field.max ?? 10000);
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
    if (submit) {
      // Submitting the form completes the first step of the pathway.
      const formStep = get<{ id: string; status: string }>(
        `SELECT es.id, es.status FROM enrollment_steps es JOIN pathway_steps ps ON ps.id = es.step_id
          WHERE es.enrollment_id = ? AND ps.profession = 'patient' ORDER BY ps.position LIMIT 1`,
        enrollment.id,
      );
      if (formStep && formStep.status !== "realisee") {
        run("UPDATE enrollment_steps SET status = 'realisee', completed_at = ? WHERE id = ?", now, formStep.id);
        const next = get<{ id: string }>(
          `SELECT es.id FROM enrollment_steps es JOIN pathway_steps ps ON ps.id = es.step_id
            WHERE es.enrollment_id = ? AND es.status = 'a_venir' ORDER BY ps.position LIMIT 1`,
          enrollment.id,
        );
        if (next) run("UPDATE enrollment_steps SET status = 'en_cours' WHERE id = ?", next.id);
      }
    }
  });
  logAccess("patient", patient.id, patient.id, submit ? "envoi_formulaire" : "brouillon_formulaire");
  refresh();
  redirect(submit ? "/patient?formulaire=envoye" : "/patient/formulaire?brouillon=1");
}

export async function addCheckin(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const km = intOrNull(formData, "weekly_km", 0, 400);
  const pain = intOrNull(formData, "pain", 0, 10);
  const fatigue = intOrNull(formData, "fatigue", 0, 10);
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
  run(
    "UPDATE enrollments SET sharing_opposed = ?, consent_updated_at = ? WHERE id = ?",
    opposed ? 1 : 0, new Date().toISOString(), enrollment.id,
  );
  logAccess("patient", patient.id, patient.id, opposed ? "opposition_partage" : "levee_opposition_partage");
  refresh();
}
