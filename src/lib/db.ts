import "server-only";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SCHEMA, TABLES_CHILD_FIRST } from "./schema";
import { seed } from "./seed";

// Bump when the schema changes: an older demo database is rebuilt from scratch.
const SCHEMA_VERSION = 2;

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
  const conn = new DatabaseSync(file);
  const { user_version } = conn.prepare("PRAGMA user_version").get() as { user_version: number };
  if (user_version !== SCHEMA_VERSION) {
    conn.exec("PRAGMA foreign_keys = OFF;");
    const tables = conn
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all() as { name: string }[];
    for (const { name } of tables) conn.exec(`DROP TABLE IF EXISTS "${name}"`);
    conn.exec(SCHEMA);
    conn.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  }
  conn.exec("PRAGMA foreign_keys = ON;");
  conn.exec(SCHEMA);
  const { n } = conn.prepare("SELECT COUNT(*) AS n FROM coordinators").get() as { n: number };
  if (n === 0) transaction(conn, () => seed(conn));
  return conn;
}

const globalForDb = globalThis as unknown as { viaSanaDb?: DatabaseSync; viaSanaDbVersion?: number };
if (globalForDb.viaSanaDbVersion !== SCHEMA_VERSION) {
  globalForDb.viaSanaDb?.close();
  globalForDb.viaSanaDb = undefined;
}
export const db = globalForDb.viaSanaDb ?? open();
globalForDb.viaSanaDb = db;
globalForDb.viaSanaDbVersion = SCHEMA_VERSION;

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
// Positional values, or one object of named values (":name" placeholders).
type Params = SQLInputValue[] | [Record<string, SQLInputValue>];

export function all<T>(sql: string, ...params: Params): T[] {
  return db.prepare(sql).all(...(params as SQLInputValue[])).map((row) => ({ ...row }) as T);
}

export function get<T>(sql: string, ...params: Params): T | undefined {
  const row = db.prepare(sql).get(...(params as SQLInputValue[]));
  return row ? ({ ...row } as T) : undefined;
}

export function run(sql: string, ...params: Params) {
  return db.prepare(sql).run(...(params as SQLInputValue[]));
}
