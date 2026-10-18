"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { endSession, requireCoordinator, requirePatient, requirePractitioner, startSession } from "@/lib/auth";
import { get, resetDemoData, run, transaction } from "@/lib/db";
import { BILAN_DIMENSIONS, COORDINATION_OFFER, INTAKE_SECTIONS, needsMedicalOpinion, type IntakeAnswers } from "@/lib/domain";
import { addCatalogStep, advance, completeStep, instantiatePhase, skipStep } from "@/lib/pathway";
import { isInCareTeam, logAccess } from "@/lib/queries";
import { SPACES, isSpace, type SpaceSlug } from "@/lib/spaces";
import { PASSWORD_MAX_LENGTH, passwordProblem } from "@/lib/passwords";
import {
  MAX_CODE_ATTEMPTS, checkPassword, createAuthUser, currentStep, endStep, recordWrongCode, resendCode, startEmailStep,
  supabaseAuthReady, syncAuthUsers, verifyCode,
} from "@/lib/supabase-auth";

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

export type LoginState = { error: string | null };

const LOGIN_ERROR = "Email ou mot de passe incorrect.";
const UNAVAILABLE = "Connexion momentanément indisponible. Réessayez dans un instant.";
const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

type CredentialRow = {
  email: string;
  user_type: "patient" | "practitioner" | "coordinator";
  user_id: string;
  auth_user_id: string | null;
  demo: number;
  failed_count: number;
  locked_until: string | null;
};

async function authLog(userType: string, userId: string, event: string) {
  await run("INSERT INTO auth_logs (user_type, user_id, event, at) VALUES (?, ?, ?, ?)", userType, userId, event, new Date().toISOString());
}

/** Where a person lands once signed in. A new client goes straight to the questionnaire. */
async function homeFor(type: CredentialRow["user_type"], id: string) {
  if (type === "coordinator") return "/coordination";
  if (type === "practitioner") return "/praticien";
  const sent = await get(
    `SELECT 1 AS ok FROM intake_forms f JOIN enrollments e ON e.id = f.enrollment_id
      WHERE e.patient_id = ? AND f.submitted_at IS NOT NULL`,
    id,
  );
  return sent ? "/patient" : "/patient/formulaire";
}

/**
 * Login, first factor. Supabase Auth checks the password; the app keeps its
 * own rules (CNIL recommendation 2022-100): one generic error message, each
 * space only accepts its own accounts, the account is suspended for 15 minutes
 * after 5 failures in a row, and neither the password nor an unknown email is
 * written to the logs. A right password only starts the email step.
 */
export async function loginWithPassword(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = text(formData, "email", 120).toLowerCase();
  const raw = formData.get("password");
  const password = typeof raw === "string" ? raw.slice(0, PASSWORD_MAX_LENGTH) : "";
  if (!email || !password) return { error: LOGIN_ERROR };
  if (!supabaseAuthReady()) return { error: UNAVAILABLE };

  // A wrong space is answered exactly like an unknown email: same message, same work.
  const space = text(formData, "space", 20);
  const expected = isSpace(space) ? SPACES[space].userType : null;
  let credential = await get<CredentialRow>("SELECT * FROM credentials WHERE email = ?", email);
  if (!credential || credential.user_type !== expected) {
    await checkPassword(email, password).catch(() => false);
    return { error: LOGIN_ERROR };
  }
  if (credential.locked_until !== null && credential.locked_until > new Date().toISOString()) return { error: LOGIN_ERROR };
  if (!credential.auth_user_id) {
    // First login since the demo data was created or reset: create the Supabase users.
    await syncAuthUsers();
    credential = (await get<CredentialRow>("SELECT * FROM credentials WHERE email = ?", email))!;
  }

  let valid: boolean;
  try {
    valid = await checkPassword(email, password);
  } catch {
    return { error: UNAVAILABLE };
  }
  if (!valid) {
    await registerFailure(credential);
    return { error: LOGIN_ERROR };
  }

  // Right password: second factor by email. No session until the code is entered.
  try {
    await startEmailStep({ email, userType: credential.user_type, userId: credential.user_id, space: space as SpaceSlug, demo: credential.demo === 1 });
  } catch {
    return { error: "Le code n'a pas pu être envoyé. Réessayez dans une minute." };
  }
  await authLog(credential.user_type, credential.user_id, "code_envoye");
  redirect("/connexion/verification");
}

/** One more failure on the account; the 5th in a row suspends it for 15 minutes. */
async function registerFailure(credential: Pick<CredentialRow, "email" | "user_type" | "user_id" | "failed_count" | "locked_until">) {
  const failures = credential.failed_count + 1;
  const lockUntil = failures >= MAX_FAILURES ? new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString() : null;
  await run(
    "UPDATE credentials SET failed_count = ?, locked_until = ? WHERE email = ?",
    lockUntil ? 0 : failures, lockUntil ?? credential.locked_until, credential.email,
  );
  await authLog(credential.user_type, credential.user_id, lockUntil ? "verrouillage" : "echec");
}

export type VerifyState = { error: string | null; info: string | null; expired?: boolean };

/**
 * Login, second factor: Supabase checks the code received by email, or sends a
 * new one. Five wrong codes end the step and count as a failure on the account.
 */
export async function verifyLoginCode(_prev: VerifyState, formData: FormData): Promise<VerifyState> {
  const step = await currentStep();
  if (!step) return { error: "Ce code a expiré. Reconnectez-vous pour en recevoir un nouveau.", info: null, expired: true };

  if (text(formData, "intent", 10) === "resend") {
    let sent = false;
    try {
      sent = await resendCode(step);
    } catch {
      return { error: "Le nouveau code n'a pas pu être envoyé. Patientez une minute avant de réessayer.", info: null };
    }
    if (!sent) return { error: "Vous avez déjà demandé 3 nouveaux codes. Reconnectez-vous.", info: null };
    await authLog(step.userType, step.userId, "code_envoye");
    refresh(); // the demo mailbox shows the new message
    return { error: null, info: "Un nouveau code vient d'être envoyé. L'ancien ne fonctionne plus." };
  }

  const code = text(formData, "code", 20).replace(/\D/g, "");
  // Supabase codes are 6 to 10 digits long, depending on the project setting.
  if (code.length < 6 || code.length > 10 || !(await verifyCode(step, code))) {
    const attempts = await recordWrongCode(step);
    await authLog(step.userType, step.userId, "code_refuse");
    if (attempts >= MAX_CODE_ATTEMPTS) {
      await endStep(step);
      const credential = await get<CredentialRow>("SELECT * FROM credentials WHERE email = ?", step.email);
      if (credential) await registerFailure(credential);
      return { error: "Trop de codes incorrects. Reconnectez-vous.", info: null, expired: true };
    }
    const left = MAX_CODE_ATTEMPTS - attempts;
    return { error: `Code incorrect ou expiré. Il vous reste ${left} essai${left > 1 ? "s" : ""}.`, info: null };
  }

  await endStep(step);
  await run("UPDATE credentials SET failed_count = 0, locked_until = NULL WHERE email = ?", step.email);
  await authLog(step.userType, step.userId, "connexion");
  await startSession({ type: step.userType, id: step.userId });
  if (step.userType === "patient") await logAccess("patient", step.userId, step.userId, "connexion");
  redirect(await homeFor(step.userType, step.userId));
}

/** Leaves the second step and goes back to the space's login page. */
export async function cancelLoginCode() {
  const step = await currentStep();
  await endStep(step);
  redirect(step ? SPACES[step.space].login : "/connexion");
}

export type SignupState = { error: string | null; values: Record<string, string> };

/**
 * A new client starts their "bilan de course" from the landing page: the
 * account (its password goes to Supabase Auth), the enrolment and the bilan
 * steps are created, the partner physio who runs the bilans is attached as
 * referent, and the client lands on the questionnaire.
 */
export async function startBilan(_prev: SignupState, formData: FormData): Promise<SignupState> {
  const first = text(formData, "first_name", 60);
  const last = text(formData, "last_name", 60);
  const email = text(formData, "email", 120).toLowerCase();
  const phone = text(formData, "phone", 30);
  const birth = text(formData, "birth_date", 10);
  const goalInput = text(formData, "goal", 120);
  const goal = goalInput || "Préparer ma course";
  const sex = ["F", "M", "X"].includes(text(formData, "sex")) ? text(formData, "sex") : "X";
  const rawPassword = formData.get("password");
  const password = typeof rawPassword === "string" ? rawPassword : "";
  const confirmation = formData.get("password_confirmation");
  // Passwords are never sent back to the browser.
  const values = { first_name: first, last_name: last, email, phone, birth_date: birth, goal: goalInput, sex };
  const fail = (error: string): SignupState => ({ error, values });

  if (!first || !last || !/^\S+@\S+\.\S+$/.test(email) || !/^\d{4}-\d{2}-\d{2}$/.test(birth) || text(formData, "consent") !== "1") {
    return fail("Merci de vérifier les champs obligatoires et d'accepter les conditions.");
  }
  const weak = passwordProblem(password, [first, last, email.split("@")[0]]);
  if (weak) return fail(weak);
  if (password !== confirmation) return fail("Les deux mots de passe ne correspondent pas.");
  if (await get("SELECT 1 AS ok FROM credentials WHERE email = ?", email)) {
    return fail("Un compte existe déjà avec cet email. Connectez-vous ou utilisez une autre adresse.");
  }
  if (!supabaseAuthReady()) return fail("Inscription momentanément indisponible. Réessayez plus tard.");

  const coordinator = await get<{ id: string }>("SELECT id FROM coordinators ORDER BY id LIMIT 1");
  const physio = await get<{ id: string }>(
    "SELECT id FROM practitioners WHERE profession = 'kine' ORDER BY CASE WHEN specialty LIKE '%bilans de course%' THEN 0 ELSE 1 END, last_name LIMIT 1",
  );
  if (!coordinator || !physio) return fail("Inscription momentanément indisponible. Réessayez plus tard.");

  let authUserId: string;
  try {
    authUserId = await createAuthUser(email, password);
  } catch (error) {
    return fail(error instanceof Error && error.message.startsWith("Un compte") ? error.message : "Inscription momentanément indisponible. Réessayez plus tard.");
  }
  const now = new Date().toISOString();
  const patientId = `pa-${randomUUID()}`;
  const enrollmentId = `en-${randomUUID()}`;
  await transaction(async (tx) => {
    await tx.run(
      "INSERT INTO patients (id, first_name, last_name, birth_date, sex, email, phone, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      patientId, first, last, birth, sex, email, phone, now,
    );
    await tx.run(
      "INSERT INTO credentials (email, user_type, user_id, auth_user_id, password_changed_at) VALUES (?, 'patient', ?, ?, ?)",
      email, patientId, authUserId, now,
    );
    await tx.run(
      `INSERT INTO enrollments (id, patient_id, pathway_id, coordinator_id, offer, status, start_date, goal_title, goal_detail)
       VALUES (?, ?, 'pw-prepa', ?, 'bilan', 'actif', ?, ?, '')`,
      enrollmentId, patientId, coordinator.id, now.slice(0, 10), goal,
    );
    // The partner physio who runs the bilans: the client accepts them by signing up for the bilan.
    await tx.run(
      "INSERT INTO care_team (enrollment_id, practitioner_id, status, is_referent, proposed_at, decided_at) VALUES (?, ?, 'acceptee', 1, ?, ?)",
      enrollmentId, physio.id, now, now,
    );
    await instantiatePhase(tx, enrollmentId, "bilan");
    await advance(tx, enrollmentId);
  });
  await startSession({ type: "patient", id: patientId });
  await logAccess("patient", patientId, patientId, "inscription");
  refresh();
  redirect("/patient/formulaire");
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function resetDemo() {
  // Demo-only convenience: there is nothing but fictional data in this database.
  // Reserved to the coordinator: anyone else could wipe the shared demo.
  await requireCoordinator();
  await resetDemoData();
  // Supabase users of accounts created during the demo are removed, demo passwords restored.
  await syncAuthUsers().catch(() => {});
  await endSession();
  refresh();
  redirect("/connexion");
}

// ------------------------------------------------------------- Practitioner

/** Resolves the enrollment and verifies the patient accepted this practitioner. */
async function practitionerOn(enrollmentId: string, action: string) {
  const practitioner = await requirePractitioner();
  const enrollment = await get<{ id: string; patient_id: string }>("SELECT id, patient_id FROM enrollments WHERE id = ?", enrollmentId);
  if (!enrollment) throw new Error("Parcours introuvable");
  if (!(await isInCareTeam(practitioner.id, enrollment.id))) {
    await logAccess("practitioner", practitioner.id, enrollment.patient_id, action, false);
    throw new Error("Accès refusé : vous ne faites pas partie de l'équipe de soins de ce patient.");
  }
  await logAccess("practitioner", practitioner.id, enrollment.patient_id, action);
  return { practitioner, enrollment };
}

export async function addNote(formData: FormData) {
  const { practitioner, enrollment } = await practitionerOn(text(formData, "enrollmentId", 100), "ajout_note");
  const body = text(formData, "body", 4000);
  const visibility = text(formData, "visibility");
  if (!body || !["equipe", "privee", "patient"].includes(visibility)) return;
  await run(
    "INSERT INTO notes (id, enrollment_id, author_id, body, visibility, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    randomUUID(), enrollment.id, practitioner.id, body, visibility, new Date().toISOString(),
  );
  refresh();
}

export async function updateStep(formData: FormData) {
  const step = await get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  if (!step) return;
  const { practitioner } = await practitionerOn(step.enrollment_id, "mise_a_jour_etape");
  // A step is closed by the profession that performs it, or by the referent.
  const referent = await get(
    "SELECT 1 AS ok FROM care_team WHERE enrollment_id = ? AND practitioner_id = ? AND is_referent = 1",
    step.enrollment_id, practitioner.id,
  );
  if (step.profession !== practitioner.profession && !referent) return;
  // The action plan is closed by publishing the report, not by hand.
  if (step.title === "Plan d'action remis") return;
  const status = text(formData, "status");
  await transaction(async (tx) => {
    if (status === "realisee") {
      await completeStep(tx, step.id, text(formData, "summary", 1000));
    } else if (status === "en_cours") {
      await tx.run("UPDATE enrollment_steps SET status = 'a_venir' WHERE enrollment_id = ? AND status = 'en_cours'", step.enrollment_id);
      await tx.run(
        "UPDATE enrollment_steps SET status = 'en_cours', practitioner_id = COALESCE(practitioner_id, ?) WHERE id = ?",
        practitioner.id, step.id,
      );
    }
  });
  refresh();
}

export async function scheduleSession(formData: FormData) {
  const { practitioner, enrollment } = await practitionerOn(text(formData, "enrollmentId", 100), "planification_seance");
  const when = startsAt(formData);
  if (!when) return;
  const stepId = text(formData, "stepId", 100);
  const step = stepId
    ? await get<{ id: string }>("SELECT id FROM enrollment_steps WHERE id = ? AND enrollment_id = ?", stepId, enrollment.id)
    : undefined;
  await run(
    `INSERT INTO sessions (id, enrollment_id, enrollment_step_id, practitioner_id, starts_at, duration_min, location, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'prevue')`,
    randomUUID(), enrollment.id, step?.id ?? null, practitioner.id, when, numberOrNull(formData, "duration", 15, 180) ?? 30, practitioner.location,
  );
  refresh();
}

export async function setSessionStatus(formData: FormData) {
  const session = await get<{ id: string; enrollment_id: string; practitioner_id: string }>(
    "SELECT id, enrollment_id, practitioner_id FROM sessions WHERE id = ?",
    text(formData, "sessionId", 100),
  );
  if (!session) return;
  const { practitioner } = await practitionerOn(session.enrollment_id, "mise_a_jour_seance");
  const status = text(formData, "status");
  // Only the practitioner who owns the appointment can close or cancel it.
  if (session.practitioner_id !== practitioner.id || !["realisee", "annulee"].includes(status)) return;
  await run("UPDATE sessions SET status = ? WHERE id = ?", status, session.id);
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
  const fields = [JSON.stringify(findings), text(formData, "recommendations", 2000), text(formData, "action_plan", 2000)];

  await transaction(async (tx) => {
    const existing = await tx.get<{ id: string }>(
      "SELECT id FROM reports WHERE enrollment_id = ? AND author_id = ? AND title = 'Bilan de course'",
      enrollment.id, practitioner.id,
    );
    const planStep = await tx.get<{ id: string; status: string }>(
      "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Plan d''action remis'", enrollment.id,
    );
    const bilanStep = await tx.get<{ id: string; status: string }>(
      "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Bilan de course (30 min)'", enrollment.id,
    );
    if (existing) {
      await tx.run(
        "UPDATE reports SET findings = ?, recommendations = ?, action_plan = ?, published_at = COALESCE(published_at, ?) WHERE id = ?",
        ...fields, publish ? now : null, existing.id,
      );
    } else {
      await tx.run(
        `INSERT INTO reports (id, enrollment_id, enrollment_step_id, author_id, title, findings, recommendations, action_plan, created_at, published_at)
         VALUES (?, ?, ?, ?, 'Bilan de course', ?, ?, ?, ?, ?)`,
        randomUUID(), enrollment.id, planStep?.id ?? null, practitioner.id, ...fields, now, publish ? now : null,
      );
    }
    if (publish) {
      if (bilanStep && bilanStep.status !== "realisee") await completeStep(tx, bilanStep.id, "Bilan réalisé, compte rendu publié.");
      if (planStep && planStep.status !== "realisee") await completeStep(tx, planStep.id);
    }
  });
  refresh();
}

// -------------------------------------------------------------- Coordinator

/** The coordinator only acts on the patients they coordinate — and on logistics only. */
async function coordinatorOn(enrollmentId: string, action: string) {
  const coordinator = await requireCoordinator();
  const enrollment = await get<{ id: string; patient_id: string }>(
    "SELECT id, patient_id FROM enrollments WHERE id = ? AND coordinator_id = ?",
    enrollmentId, coordinator.id,
  );
  if (!enrollment) throw new Error("Parcours introuvable");
  await logAccess("coordinator", coordinator.id, enrollment.patient_id, action);
  return { coordinator, enrollment };
}

export async function proposeMember(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "proposition_praticien");
  const practitionerId = text(formData, "practitionerId", 100);
  if (!(await get("SELECT 1 AS ok FROM practitioners WHERE id = ?", practitionerId))) return;
  // The practitioner gets no access until the patient accepts (CSP L1110-12, 2°).
  await run(
    `INSERT INTO care_team (enrollment_id, practitioner_id, status, is_referent, proposed_at)
     VALUES (?, ?, 'proposee', 0, ?)
     ON CONFLICT (enrollment_id, practitioner_id) DO UPDATE SET status = 'proposee', proposed_at = excluded.proposed_at, decided_at = NULL`,
    enrollment.id, practitionerId, new Date().toISOString(),
  );
  refresh();
}

export async function addPlanStep(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "ajout_etape");
  const catalogId = text(formData, "catalogId", 100);
  const catalog = await get<{ profession: string }>("SELECT profession FROM step_catalog WHERE id = ?", catalogId);
  if (!catalog) return;
  const week = numberOrNull(formData, "week", 0, 52) ?? 4;
  const practitioner = await get<{ id: string }>(
    `SELECT pr.id FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ? AND ct.status = 'acceptee' AND pr.profession = ? ORDER BY ct.is_referent DESC LIMIT 1`,
    enrollment.id, catalog.profession,
  );
  await transaction((tx) => addCatalogStep(tx, enrollment.id, catalogId, Math.round(week), practitioner?.id ?? null));
  refresh();
}

export async function coordinateSession(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "planification_seance");
  const step = await get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  const when = startsAt(formData);
  if (!step || step.enrollment_id !== enrollment.id || !when) return;
  const practitionerId = text(formData, "practitionerId", 100) || step.practitioner_id || "";
  const practitioner = await get<{ id: string; location: string }>(
    `SELECT pr.id, pr.location FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ? AND ct.practitioner_id = ? AND ct.status = 'acceptee'`,
    enrollment.id, practitionerId,
  );
  if (!practitioner) return;
  await transaction(async (tx) => {
    await tx.run("UPDATE enrollment_steps SET practitioner_id = COALESCE(practitioner_id, ?) WHERE id = ?", practitioner.id, step.id);
    await tx.run(
      `INSERT INTO sessions (id, enrollment_id, enrollment_step_id, practitioner_id, starts_at, duration_min, location, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'prevue')`,
      randomUUID(), enrollment.id, step.id, practitioner.id, when, numberOrNull(formData, "duration", 15, 180) ?? 30, practitioner.location,
    );
  });
  refresh();
}

export async function skipOptionalStep(formData: FormData) {
  const step = await get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  if (!step || step.optional !== 1) return;
  await coordinatorOn(step.enrollment_id, "etape_non_retenue");
  await transaction((tx) => skipStep(tx, step.id));
  refresh();
}

export async function completeCoordinationStep(formData: FormData) {
  const step = await get<StepRow>(STEP_SELECT, text(formData, "stepId", 100));
  if (!step || step.profession !== "coordinateur") return;
  await coordinatorOn(step.enrollment_id, "mise_a_jour_etape");
  await transaction((tx) => completeStep(tx, step.id));
  refresh();
}

export async function addRelance(formData: FormData) {
  const { coordinator, enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "relance");
  const channel = text(formData, "channel");
  const reason = text(formData, "reason", 300);
  if (!["email", "sms", "telephone"].includes(channel) || !reason) return;
  await run(
    "INSERT INTO relances (id, enrollment_id, coordinator_id, channel, reason, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    randomUUID(), enrollment.id, coordinator.id, channel, reason, new Date().toISOString(),
  );
  refresh();
}

export async function setEnrollmentStatus(formData: FormData) {
  const { enrollment } = await coordinatorOn(text(formData, "enrollmentId", 100), "changement_statut_parcours");
  const status = text(formData, "status");
  if (!["actif", "en_pause", "termine"].includes(status)) return;
  await run("UPDATE enrollments SET status = ? WHERE id = ?", status, enrollment.id);
  refresh();
}

// ------------------------------------------------------------------ Patient

async function currentEnrollment() {
  const patient = await requirePatient();
  const enrollment = await get<{ id: string; offer: string; status: string }>(
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
      if (field.type === "choice" && field.multiple) {
        // Only known options are kept; "Aucun(e)" cancels the other ticks.
        const picked = formData.getAll(field.id).filter((v): v is string => typeof v === "string" && field.options.includes(v));
        const none = picked.find((v) => v.startsWith("Aucun"));
        answers[field.id] = none ? [none] : picked;
      } else if (field.type === "choice") {
        const v = text(formData, field.id);
        answers[field.id] = field.options.includes(v) ? v : null;
      } else if (field.type === "number" || field.type === "range") {
        answers[field.id] = numberOrNull(formData, field.id, field.min ?? 0, field.max ?? 10000);
      } else {
        answers[field.id] = text(formData, field.id, field.type === "textarea" ? 2000 : 200);
      }
    }
  }
  const submit = text(formData, "intent") === "submit";
  const now = new Date().toISOString();

  await transaction(async (tx) => {
    await tx.run(
      `INSERT INTO intake_forms (enrollment_id, answers, submitted_at, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (enrollment_id) DO UPDATE SET answers = excluded.answers, updated_at = excluded.updated_at,
         submitted_at = COALESCE(intake_forms.submitted_at, excluded.submitted_at)`,
      enrollment.id, JSON.stringify(answers), submit ? now : null, now,
    );
    if (!submit) return;
    const formStep = await tx.get<{ id: string; status: string }>(
      "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Questionnaire en ligne'", enrollment.id,
    );
    if (formStep && formStep.status !== "realisee") await completeStep(tx, formStep.id);
    // The race given in the questionnaire becomes the goal shown everywhere (J-x).
    const raceDate = typeof answers.date_course === "string" && /^\d{4}-\d{2}-\d{2}$/.test(answers.date_course) ? answers.date_course : null;
    const race = typeof answers.course === "string" && answers.course ? answers.course : null;
    await tx.run(
      `UPDATE enrollments SET goal_date = COALESCE(CAST(? AS TEXT), goal_date),
              goal_title = CASE WHEN goal_title = 'Préparer ma course' AND CAST(? AS TEXT) IS NOT NULL THEN CAST(? AS TEXT) ELSE goal_title END
        WHERE id = ?`,
      raceDate, race, race, enrollment.id,
    );
    // With a prescription already in hand, the medical teleconsultation is not
    // needed — unless the answers show cardiovascular warning signs.
    if (answers.ordonnance === "Oui" && !needsMedicalOpinion(answers)) {
      const tele = await tx.get<{ id: string; status: string }>(
        "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Téléconsultation médecin'", enrollment.id,
      );
      if (tele && (tele.status === "a_venir" || tele.status === "en_cours")) await skipStep(tx, tele.id);
    }
  });
  await logAccess("patient", patient.id, patient.id, submit ? "envoi_formulaire" : "brouillon_formulaire");
  refresh();
  redirect(submit ? "/patient?formulaire=envoye" : "/patient/formulaire?brouillon=1");
}

export async function chooseNext(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const choice = text(formData, "choice");
  const step = await get<{ id: string; status: string }>(
    "SELECT id, status FROM enrollment_steps WHERE enrollment_id = ? AND title = 'Choix de la suite'", enrollment.id,
  );
  if (!step || step.status === "realisee" || !["parcours", "stop"].includes(choice)) return;
  await transaction(async (tx) => {
    await tx.run("UPDATE enrollment_steps SET status = 'realisee', completed_at = ? WHERE id = ?", new Date().toISOString(), step.id);
    if (choice === "parcours") {
      const until = new Date();
      until.setMonth(until.getMonth() + COORDINATION_OFFER.months);
      await tx.run("UPDATE enrollments SET offer = 'parcours', coordinated_until = ? WHERE id = ?", until.toISOString().slice(0, 10), enrollment.id);
      await instantiatePhase(tx, enrollment.id, "parcours");
      await advance(tx, enrollment.id);
    } else {
      await tx.run("UPDATE enrollments SET status = 'termine' WHERE id = ?", enrollment.id);
    }
  });
  await logAccess("patient", patient.id, patient.id, choice === "parcours" ? "choix_parcours_coordonne" : "choix_arret_bilan");
  refresh();
}

export async function decideTeamMember(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const practitionerId = text(formData, "practitionerId", 100);
  const decision = text(formData, "decision") === "acceptee" ? "acceptee" : "refusee";
  const member = await get<{ profession: string }>(
    `SELECT pr.profession FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ? AND ct.practitioner_id = ? AND ct.status = 'proposee'`,
    enrollment.id, practitionerId,
  );
  if (!member) return;
  await transaction(async (tx) => {
    await tx.run(
      "UPDATE care_team SET status = ?, decided_at = ? WHERE enrollment_id = ? AND practitioner_id = ?",
      decision, new Date().toISOString(), enrollment.id, practitionerId,
    );
    if (decision === "acceptee") {
      await tx.run(
        "UPDATE enrollment_steps SET practitioner_id = ? WHERE enrollment_id = ? AND profession = ? AND practitioner_id IS NULL",
        practitionerId, enrollment.id, member.profession,
      );
    }
  });
  await logAccess("patient", patient.id, patient.id, decision === "acceptee" ? "acceptation_praticien" : "refus_praticien");
  refresh();
}

export async function addCheckin(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const km = numberOrNull(formData, "weekly_km", 0, 400);
  const pain = numberOrNull(formData, "pain", 0, 10);
  const fatigue = numberOrNull(formData, "fatigue", 0, 10);
  if (km === null && pain === null && fatigue === null) return;
  await run(
    `INSERT INTO checkins (id, enrollment_id, author_type, author_id, date, weekly_km, pain, fatigue, comment)
     VALUES (?, ?, 'patient', ?, ?, ?, ?, ?, ?)`,
    randomUUID(), enrollment.id, patient.id, new Date().toISOString().slice(0, 10),
    km, pain === null ? null : Math.round(pain), fatigue === null ? null : Math.round(fatigue), text(formData, "comment", 500),
  );
  refresh();
  redirect("/patient?suivi=envoye#suivi");
}

export async function setSharingOpposition(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const opposed = text(formData, "opposed") === "1";
  await run(
    "UPDATE enrollments SET sharing_opposed = ?, consent_updated_at = ? WHERE id = ?",
    opposed ? 1 : 0, new Date().toISOString(), enrollment.id,
  );
  await logAccess("patient", patient.id, patient.id, opposed ? "opposition_partage" : "levee_opposition_partage");
  refresh();
}

/** Sharing outside the care team requires the patient's prior consent (CSP L1110-4 III). */
export async function createShare(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  const report = await get<{ id: string }>(
    "SELECT id FROM reports WHERE id = ? AND enrollment_id = ? AND published_at IS NOT NULL",
    text(formData, "reportId", 100), enrollment.id,
  );
  const name = text(formData, "recipient_name", 120);
  const role = text(formData, "recipient_role", 120);
  if (!report || !name || !role || text(formData, "consent") !== "1") return;
  await run(
    `INSERT INTO external_shares (id, enrollment_id, report_id, recipient_name, recipient_role, token, consent_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(), enrollment.id, report.id, name, role, randomBytes(18).toString("base64url"), new Date().toISOString(),
  );
  await logAccess("patient", patient.id, patient.id, "partage_externe");
  refresh();
}

export async function revokeShare(formData: FormData) {
  const { patient, enrollment } = await currentEnrollment();
  await run(
    "UPDATE external_shares SET revoked_at = ? WHERE id = ? AND enrollment_id = ? AND revoked_at IS NULL",
    new Date().toISOString(), text(formData, "shareId", 100), enrollment.id,
  );
  await logAccess("patient", patient.id, patient.id, "revocation_partage");
  refresh();
}
