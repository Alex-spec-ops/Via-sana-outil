import "server-only";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";
import { seed } from "./seed";

// Local: ./data/via-sana.db. On serverless hosts only /tmp is writable, so the
// demo database lives there and is re-seeded on each cold start (fictional data).
function resolveDbPath() {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  if (process.env.VERCEL) return "/tmp/via-sana.db";
  return path.join(process.cwd(), "data", "via-sana.db");
}

function open() {
  const file = resolveDbPath();
  mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM practitioners").get() as { n: number };
  if (n === 0) {
    transaction(db, () => seed(db));
  }
  return db;
}

const globalForDb = globalThis as unknown as { viaSanaDb?: DatabaseSync };
export const db = globalForDb.viaSanaDb ?? open();
globalForDb.viaSanaDb = db;

const TABLES_CHILD_FIRST = [
  "access_logs", "intake_forms", "checkins", "notes", "sessions", "enrollment_steps",
  "care_team", "enrollments", "pathway_steps", "pathways", "patients", "practitioners",
];

/** Wipes every table and re-seeds the fictional demo data. */
export function resetDemoData() {
  transaction(db, () => {
    for (const table of TABLES_CHILD_FIRST) db.exec(`DELETE FROM ${table}`);
    seed(db);
  });
}

export function transaction<T>(conn: DatabaseSync, fn: () => T): T {
  conn.exec("BEGIN");
  try {
    const result = fn();
    conn.exec("COMMIT");
    return result;
  } catch (err) {
    conn.exec("ROLLBACK");
    throw err;
  }
}

// node:sqlite returns null-prototype rows; copy them into plain objects so they
// can cross the server/client component boundary.
export function all<T>(sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params).map((row) => ({ ...row }) as T);
}

export function get<T>(sql: string, ...params: SQLInputValue[]): T | undefined {
  const row = db.prepare(sql).get(...params);
  return row ? ({ ...row } as T) : undefined;
}

export function run(sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}
