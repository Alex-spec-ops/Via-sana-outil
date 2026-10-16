import { randomUUID } from "node:crypto";
import type { Db } from "./db";
import type { Phase } from "./domain";

// Rules of a patient's plan, shared by the seed and the server actions. Every
// function takes the connection to use, so it runs inside the caller's transaction.

type TemplateStep = {
  id: string;
  position: number;
  week_offset: number;
  title: string;
  description: string;
  profession: string;
  optional: number;
};

/** Copies the template steps of one phase into the patient's own plan. */
export async function instantiatePhase(db: Db, enrollmentId: string, phase: Phase) {
  const enrollment = await db.get<{ pathway_id: string }>("SELECT pathway_id FROM enrollments WHERE id = ?", enrollmentId);
  if (!enrollment) return [];
  const steps = await db.all<TemplateStep>(
    "SELECT * FROM pathway_steps WHERE pathway_id = ? AND phase = ? ORDER BY position",
    enrollment.pathway_id, phase,
  );
  const ids: string[] = [];
  for (const s of steps) {
    const id = `${enrollmentId}-${s.position}`;
    await db.run(
      `INSERT INTO enrollment_steps (id, enrollment_id, template_step_id, phase, position, planned_week, title, description, profession, optional, status, practitioner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'a_venir', ?)`,
      id, enrollmentId, s.id, phase, s.position, s.week_offset, s.title, s.description, s.profession, s.optional,
      await practitionerFor(db, enrollmentId, s.profession),
    );
    ids.push(id);
  }
  return ids;
}

/** The accepted team member of that profession (the referent first), if any. */
export async function practitionerFor(db: Db, enrollmentId: string, profession: string): Promise<string | null> {
  const row = await db.get<{ id: string }>(
    `SELECT pr.id FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
      WHERE ct.enrollment_id = ? AND ct.status = 'acceptee' AND pr.profession = ?
      ORDER BY ct.is_referent DESC LIMIT 1`,
    enrollmentId, profession,
  );
  return row?.id ?? null;
}

/** Keeps exactly one step "en cours": the first pending step of the plan. */
export async function advance(db: Db, enrollmentId: string) {
  const current = await db.get("SELECT 1 AS ok FROM enrollment_steps WHERE enrollment_id = ? AND status = 'en_cours'", enrollmentId);
  if (current) return;
  const next = await db.get<{ id: string }>(
    `SELECT id FROM enrollment_steps WHERE enrollment_id = ? AND status = 'a_venir'
      ORDER BY planned_week, position LIMIT 1`,
    enrollmentId,
  );
  if (next) await db.run("UPDATE enrollment_steps SET status = 'en_cours' WHERE id = ?", next.id);
}

/** Closes a step (and its pending appointments), then moves the plan forward. */
export async function completeStep(db: Db, stepId: string, summary = "", at = new Date().toISOString()) {
  const step = await db.get<{ enrollment_id: string }>("SELECT enrollment_id FROM enrollment_steps WHERE id = ?", stepId);
  if (!step) return;
  await db.run(
    `UPDATE enrollment_steps SET status = 'realisee', completed_at = ?,
            summary = CASE WHEN CAST(? AS TEXT) <> '' THEN CAST(? AS TEXT) ELSE summary END
      WHERE id = ?`,
    at, summary, summary, stepId,
  );
  await db.run("UPDATE sessions SET status = 'realisee' WHERE enrollment_step_id = ? AND status = 'prevue'", stepId);
  await advance(db, step.enrollment_id);
}

/** Marks an optional step as not needed for this patient. */
export async function skipStep(db: Db, stepId: string) {
  const step = await db.get<{ enrollment_id: string }>("SELECT enrollment_id FROM enrollment_steps WHERE id = ? AND optional = 1", stepId);
  if (!step) return;
  await db.run("UPDATE enrollment_steps SET status = 'non_retenue' WHERE id = ?", stepId);
  await db.run("UPDATE sessions SET status = 'annulee' WHERE enrollment_step_id = ? AND status = 'prevue'", stepId);
  await advance(db, step.enrollment_id);
}

/** Adds a step from the catalogue, in the week the coordinator chose. */
export async function addCatalogStep(db: Db, enrollmentId: string, catalogId: string, week: number, practitionerId: string | null) {
  const item = await db.get<{ title: string; description: string; profession: string }>("SELECT * FROM step_catalog WHERE id = ?", catalogId);
  if (!item) return null;
  const { pos } = (await db.get<{ pos: number }>(
    "SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM enrollment_steps WHERE enrollment_id = ?",
    enrollmentId,
  ))!;
  const id = randomUUID();
  await db.run(
    `INSERT INTO enrollment_steps (id, enrollment_id, template_step_id, phase, position, planned_week, title, description, profession, optional, status, practitioner_id)
     VALUES (?, ?, NULL, 'parcours', ?, ?, ?, ?, ?, 0, 'a_venir', ?)`,
    id, enrollmentId, pos, week, item.title, item.description, item.profession, practitionerId,
  );
  await advance(db, enrollmentId);
  return id;
}
