import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import type { Phase } from "./domain";

// Rules of a patient's plan, shared by the seed and the server actions.

type Row = Record<string, unknown>;

/** Copies the template steps of one phase into the patient's own plan. */
export function instantiatePhase(conn: DatabaseSync, enrollmentId: string, phase: Phase) {
  const enrollment = conn.prepare("SELECT pathway_id FROM enrollments WHERE id = ?").get(enrollmentId) as { pathway_id: string };
  const steps = conn
    .prepare("SELECT * FROM pathway_steps WHERE pathway_id = ? AND phase = ? ORDER BY position")
    .all(enrollment.pathway_id, phase) as Row[];
  const insert = conn.prepare(
    `INSERT INTO enrollment_steps (id, enrollment_id, template_step_id, phase, position, planned_week, title, description, profession, optional, status, practitioner_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'a_venir', ?)`,
  );
  const ids: string[] = [];
  for (const s of steps) {
    const id = `${enrollmentId}-${s.position}`;
    insert.run(
      id, enrollmentId, s.id as string, phase, s.position as number, s.week_offset as number, s.title as string,
      s.description as string, s.profession as string, s.optional as number,
      practitionerFor(conn, enrollmentId, s.profession as string),
    );
    ids.push(id);
  }
  return ids;
}

/** The accepted team member of that profession (the referent first), if any. */
export function practitionerFor(conn: DatabaseSync, enrollmentId: string, profession: string): string | null {
  const row = conn
    .prepare(
      `SELECT pr.id FROM care_team ct JOIN practitioners pr ON pr.id = ct.practitioner_id
        WHERE ct.enrollment_id = ? AND ct.status = 'acceptee' AND pr.profession = ?
        ORDER BY ct.is_referent DESC LIMIT 1`,
    )
    .get(enrollmentId, profession) as { id: string } | undefined;
  return row?.id ?? null;
}

/** Keeps exactly one step "en cours": the first pending step of the plan. */
export function advance(conn: DatabaseSync, enrollmentId: string) {
  const current = conn.prepare("SELECT 1 AS ok FROM enrollment_steps WHERE enrollment_id = ? AND status = 'en_cours'").get(enrollmentId);
  if (current) return;
  const next = conn
    .prepare(
      `SELECT id FROM enrollment_steps WHERE enrollment_id = ? AND status = 'a_venir'
        ORDER BY planned_week, position LIMIT 1`,
    )
    .get(enrollmentId) as { id: string } | undefined;
  if (next) conn.prepare("UPDATE enrollment_steps SET status = 'en_cours' WHERE id = ?").run(next.id);
}

/** Closes a step (and its pending appointments), then moves the plan forward. */
export function completeStep(conn: DatabaseSync, stepId: string, summary = "", at = new Date().toISOString()) {
  const step = conn.prepare("SELECT enrollment_id FROM enrollment_steps WHERE id = ?").get(stepId) as { enrollment_id: string } | undefined;
  if (!step) return;
  conn
    .prepare(
      `UPDATE enrollment_steps SET status = 'realisee', completed_at = ?, summary = CASE WHEN ? <> '' THEN ? ELSE summary END WHERE id = ?`,
    )
    .run(at, summary, summary, stepId);
  conn.prepare("UPDATE sessions SET status = 'realisee' WHERE enrollment_step_id = ? AND status = 'prevue'").run(stepId);
  advance(conn, step.enrollment_id);
}

/** Marks an optional step as not needed for this patient. */
export function skipStep(conn: DatabaseSync, stepId: string) {
  const step = conn.prepare("SELECT enrollment_id FROM enrollment_steps WHERE id = ? AND optional = 1").get(stepId) as { enrollment_id: string } | undefined;
  if (!step) return;
  conn.prepare("UPDATE enrollment_steps SET status = 'non_retenue' WHERE id = ?").run(stepId);
  conn.prepare("UPDATE sessions SET status = 'annulee' WHERE enrollment_step_id = ? AND status = 'prevue'").run(stepId);
  advance(conn, step.enrollment_id);
}

/** Adds a step from the catalogue, in the week the coordinator chose. */
export function addCatalogStep(conn: DatabaseSync, enrollmentId: string, catalogId: string, week: number, practitionerId: string | null) {
  const item = conn.prepare("SELECT * FROM step_catalog WHERE id = ?").get(catalogId) as Row | undefined;
  if (!item) return null;
  const { pos } = conn.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM enrollment_steps WHERE enrollment_id = ?").get(enrollmentId) as { pos: number };
  const id = randomUUID();
  conn
    .prepare(
      `INSERT INTO enrollment_steps (id, enrollment_id, template_step_id, phase, position, planned_week, title, description, profession, optional, status, practitioner_id)
       VALUES (?, ?, NULL, 'parcours', ?, ?, ?, ?, ?, 0, 'a_venir', ?)`,
    )
    .run(id, enrollmentId, pos, week, item.title as string, item.description as string, item.profession as string, practitionerId);
  advance(conn, enrollmentId);
  return id;
}
